// UN POSTE herdr POUR LES ESSAIS — un double du TRANSPORT, jamais de la preuve.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260815-0021)
//
// Le double d'avant remplaçait `remettre()` en entier :
//
//     async remettre(pane, texte) { writeFileSync(this.fichier(pane), texte); return { delivered: true }; }
//
// Il rendait donc « livré » à tout coup. **Il était plus permissif que le service qu'il
// doublait** — motif récurrent de ce dépôt — et surtout il avait sa propre idée de ce qu'est
// une remise réussie, pendant que le vrai `remettre()` en avait une autre, plus dure : depuis
// `T-20260815-0011`, il lit l'état du pane AVANT d'écrire, relit APRÈS, et rend `pris` selon
// que quelque chose a changé.
//
// Un double qui réimplémente la logique ne peut pas prouver que la logique est bonne : il
// prouve seulement que l'essai est d'accord avec lui-même. On double donc le TRANSPORT — le
// binaire `herdr` sur le PATH — et on laisse le vrai module calculer son verdict.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LES TROIS SCÉNARIOS QU'UN PANE PEUT JOUER, ET POURQUOI IL EN FAUT TROIS
//
//   • NOMINAL — l'appel passe, la boîte reste vide, la session quitte l'attente.
//     `pris: true`, par le témoin « sortie de l'attente ».
//
//   • MUET — l'appel passe, la boîte est vide, ET RIEN NE BOUGE : même statut, même écran.
//     `pris: false`. ⚠️ **C'est le cas qui prouve ce lot**, et c'est l'état exact des trois
//     panes mesurés le 2026-08-15 — tous `done` avant, tous `done` après. Le double d'avant ne
//     savait pas le jouer, donc rien ne pouvait le voir.
//
//   • EN FILE — le pair travaillait DÉJÀ et travaille encore : même statut avant et après,
//     boîte vide des deux côtés. Le seul témoin est le marqueur de file d'attente qui APPARAÎT
//     à l'écran. ⚠️ Ce scénario a été ajouté après une revue de fond qui a relevé que le double
//     ne savait pas le jouer : le troisième témoin n'était donc éprouvé nulle part en
//     intégration, et un pair occupé — le cas le plus fréquent — n'était couvert par rien.
//
//   • COLLANT — le texte reste dans la boîte de saisie et l'envoi ne le décoince pas.
//     `remettre()` JETTE. Distinct du muet : ici on sait que ça n'est pas passé ; là on ne
//     sait rien. Les deux rendent « pas remis », pour deux raisons qu'il ne faut pas confondre.

import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

/** Le faux binaire, écrit tel quel sur le disque — il ne peut rien importer de nos modules. */
const BINAIRE = (execPath) => `#!${execPath}
const { readFileSync, writeFileSync, existsSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');

const ETAT = process.env.FAUX_HERDR_ETAT;
const a = process.argv.slice(2);
const dit = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
const brut = (s) => { process.stdout.write(s); process.exit(0); };

// L'ÉCRAN, tel qu'un terminal le rend : la boîte de saisie est le dernier couple de filets,
// et son contenu commence après l'invite. C'est la STRUCTURE que \`contenuBoite\` lit — un
// double qui rendrait n'importe quoi ferait passer une boîte pour illisible, pas pour vide.
// ⚠️ \`horsBoite\` pose ce qui s'affiche PAR-DESSUS la boîte — un dialogue de choix, un écran de
// confiance. Sans lui, aucun essai ne peut mettre une boîte lisible SOUS un modal, et c'est
// justement le cas où la touche d'envoi CONFIRME une action au lieu de soumettre un texte.
const ecran = (boite, file, horsBoite) => [
  'un peu de sortie precedente',
  ...(horsBoite ? [horsBoite] : []),
  ...(file ? ['Press up to edit queued messages'] : []),
  '────────────────────────────',
  '❯ ' + boite,
  '────────────────────────────',
].join('\\n') + '\\n';

const cle = (pane) => join(ETAT, pane.replace(/[^a-z0-9]/gi, '_') + '.json');
const lire = (pane) => {
  const f = cle(pane);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const ecrire = (pane, e) => writeFileSync(cle(pane), JSON.stringify(e));

if (a[0] === 'pane' && a[1] === 'current') {
  dit({ result: { pane: { pane_id: process.env.FAUX_PANE, foreground_cwd: process.env.FAUX_CWD || '/w' } } });
}

const pane = a[2];
const e = pane ? lire(pane) : null;

// ⚠️ LE JOURNAL DES APPELS — la seule façon de prouver une ABSTENTION. Qu'une touche d'envoi
// n'ait pas été envoyée ne se lit dans aucun état final : il faut la liste de ce qui a été
// tenté. Écrit AVANT toute sortie, y compris les sorties d'erreur.
appendFileSync(join(ETAT, 'appels.jsonl'), JSON.stringify(a) + '\\n');

// ⚠️ L'INVENTAIRE PASSE PAR LE TRANSPORT, LUI AUSSI (T-20260818-0078). Ce faux binaire ne
// servait PAS \`agent list\` : \`posteHerdr\` doublait \`agents()\` au niveau module, et tout ce
// qui appelle le vrai \`agents()\` de \`herdr.js\` voyait donc **zéro agent** sur ce banc. Un
// balayeur éprouvé là-dessus ne balaierait rien et rendrait vert sans avoir jamais balayé —
// le banc qui ne peut pas échouer, une troisième fois dans ce dépôt.
//
// ⚠️ IL RÉPOND AVANT LA RECHERCHE DE PANE : \`agent list\` n'en désigne aucun, et la garde
// \`agent_not_found\` d'en dessous le refuserait donc systématiquement.
if (a[0] === 'agent' && a[1] === 'list') {
  const f = join(ETAT, 'agents.json');
  dit({ result: { agents: existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [] } });
}

// ⚠️ UN PANE INCONNU N'EST PAS UN PANE VIDE — herdr rend \`agent_not_found\` sur stdout, avec
// un code de sortie 0. C'est le piège que le vrai module ferme ; le double doit le poser.
if (!e) dit({ error: { code: 'agent_not_found', message: pane || 'sans pane' } });

// Ce que l'agent a REÇU — ce qui a franchi la boîte, jamais ce qu'on a tenté d'y écrire.
const recu = (contenu) => appendFileSync(join(ETAT, pane.replace(/[^a-z0-9]/gi, '_') + '.txt'), contenu);

if (a[0] === 'agent' && a[1] === 'prompt') {
  const texte = a.slice(3).join(' ');
  // ⚠️ MESURÉ LE 2026-08-17 CONTRE LE VRAI SERVICE (T-20260817-0006) — et c'est tout l'objet
  // de ce lot. \`agent prompt\` n'écrit PAS dans une boîte vide : il ABOUTE son texte à ce qui
  // s'y trouve déjà, SANS SÉPARATEUR, et l'ensemble part comme UN SEUL message.
  //
  // La preuve est dans la transcription du destinataire : une boîte portant
  // « AAAA-texte-immobile-de-son-auteur-AAAA » a fait recevoir à l'agent, en un seul tour,
  // « AAAA-texte-immobile-de-son-auteur-AAAABBBB-arbitrage-du-dirigeant-BBBB ».
  //
  // Le double d'avant écrivait \`e.boite = texte\` — il REMPLAÇAIT. Le mode de panne n'existait
  // donc NULLE PART dans ce module, et aucun essai ne pouvait rougir dessus, quelle que soit
  // la mutation qu'on tentait. C'était un banc qui ne pouvait pas échouer.
  const fusion = (e.boite || '') + texte;
  if (e.colle) e.boite = fusion;                      // rien ne part : le mélange reste en boîte
  else { recu(fusion); e.boite = ''; }                // le mélange PART, comme un seul message
  e.promptFait = true;                                // le dialogue d'APRÈS peut désormais s'afficher
  if (e.file) e.enFile = true;                        // il rejoint la file d'un pair occupé
  if (!e.muet && !e.file) e.statut = 'working';       // la session quitte l'attente
  ecrire(pane, e);
  dit({ result: { delivered: true, pane_id: pane } });
}

if (a[0] === 'agent' && a[1] === 'send-keys') {
  // La touche d'envoi soumet CE QUE PORTE LA BOÎTE — son contenu entier, pas le dernier texte
  // écrit. C'est par là que la fusion est confirmée quand \`agent prompt\` ne l'a pas soumise :
  // le scénario \`cede\` est la mesure n°2 du 2026-08-17, où le texte est resté en boîte et où
  // c'est le geste de RÉPARATION de \`remettre\` qui a soumis le mélange.
  if (!e.colle || e.cede) { if (e.boite) recu(e.boite); e.boite = ''; ecrire(pane, e); }
  dit({ result: { sent: true } });                    // sinon, un pane collant ne se décoince pas
}

if (a[0] === 'agent' && a[1] === 'get') dit({ result: { agent: { pane_id: pane, agent_status: e.statut } } });
if (a[0] === 'agent' && a[1] === 'read') brut(ecran(e.boite, e.enFile, e.horsBoite || (e.promptFait ? e.horsBoiteApres : '')));

dit({ error: { code: 'unsupported', message: a.join(' ') } });
`;

/**
 * Un poste herdr complet pour un essai : le binaire sur le PATH, et l'état des panes sur
 * disque. Rend de quoi piloter les scénarios et lire ce qui est arrivé où.
 *
 * `agents` / `vivant` restent des doubles simples et assumés : l'inventaire des sessions ne
 * porte aucune preuve, et le faire passer par le disque n'apprendrait rien à personne.
 */
export function posteHerdr(racine, agents, nom = 'herdr') {
  const etat = join(racine, `etat-${nom}`);
  const bin = join(racine, `bin-${nom}`);
  mkdirSync(etat, { recursive: true });
  mkdirSync(bin, { recursive: true });
  const faux = join(bin, 'herdr');
  writeFileSync(faux, BINAIRE(process.execPath));
  chmodSync(faux, 0o755);
  // L'inventaire que le TRANSPORT servira — le même que celui du double de module, écrit une
  // fois pour les deux. `agents()` ne garde que les entrées portant un `agent` : sans lui, la
  // liste serait filtrée à vide et le banc redeviendrait aveugle.
  writeFileSync(
    join(etat, 'agents.json'),
    JSON.stringify(agents.map((a) => ({ agent: 'claude', agent_status: 'idle', ...a })))
  );

  const poste = {
    etat,
    bin,
    /** Le PATH à donner aux sous-processus — et au processus d'essai lui-même. */
    path: `${bin}:${process.env.PATH}`,
    fichier(pane) {
      return join(etat, `${pane.replace(/[^a-z0-9]/gi, '_')}.txt`);
    },
    recu(pane) {
      const f = this.fichier(pane);
      return existsSync(f) ? readFileSync(f, 'utf8') : null;
    },
    /** Tout ce qui a été demandé à herdr, dans l'ordre — pour prouver ce qui N'A PAS été fait. */
    appels() {
      const f = join(etat, 'appels.jsonl');
      if (!existsSync(f)) return [];
      return readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    },
    /** Les gestes visant un pane donné. */
    gestes(id) {
      return this.appels().filter((a) => a[2] === id);
    },
    /** Déclare un pane, et le scénario qu'il joue. Sans appel, un pane est INCONNU de herdr. */
    pane(id, { statut = 'idle', boite = '', muet = false, colle = false, cede = false, file = false, horsBoite = '', horsBoiteApres = '' } = {}) {
      // `file` implique un pair DÉJÀ occupé : son statut ne bougera pas, seul le marqueur
      // apparaîtra. Le poser à `idle` donnerait « sortie de l'attente » et prouverait un
      // autre témoin que celui qu'on veut éprouver.
      writeFileSync(
        join(etat, `${id.replace(/[^a-z0-9]/gi, '_')}.json`),
        JSON.stringify({ statut: file ? 'working' : statut, boite, muet, colle, cede, file, horsBoite, horsBoiteApres, promptFait: false, enFile: false })
      );
      return this;
    },
    async vivant(pane) {
      return agents.some((a) => a.pane_id === pane);
    },
    async agents() {
      return agents.map((a) => ({ agent: 'claude', herdr_socket: `/s/${a.pane_id}`, ...a }));
    },
  };
  return poste;
}

// L'ÉCHO ENTRE PAIRS DIT « REMIS » QUAND IL L'A PROUVÉ (T-20260815-0021).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA PORTE JUMELLE
//
// `T-20260815-0011` a fermé un chemin : la parole du dirigeant ne porte un crochet que si la
// prise par l'agent est CONSTATÉE. Le verdict est calculé dans `herdr.remettre()`, donc il est
// rendu à TOUS ses appelants — il y en a trois dans `veilleur.js`.
//
//   • `remettreAuChantier` le lit — c'est lui qui pose ou ne pose pas le crochet ;
//   • `diffuserConsigne` le lit — elle ne compte que ce qu'elle a prouvé ;
//   • `echoAuPair` le JETAIT, et rendait `remis: true` sur la seule absence d'exception.
//
// Le fait était là, calculé, disponible, et un seul des trois ne le regardait pas. **C'est le
// motif de ce dépôt — une porte fermée, sa jumelle ouverte — appliqué à la ligne qui porte la
// conversation entre un gestionnaire et son orchestrateur.**
//
// Ce que ça coûte : la réponse à la question du dirigeant — *« peut-on parler d'un agent à
// l'autre ? »* — reste « oui » même quand le message dort dans un pane. Un gestionnaire relance
// son orchestrateur, obtient « remis », et attend une réponse que personne n'a lue.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI A RENDU CE LOT POSSIBLE, ET QUI ÉTAIT LE VRAI TRAVAIL
//
// Le double d'essai remplaçait `remettre()` en entier et rendait « livré » à tout coup. Il ne
// pouvait donc **pas** montrer un pane où rien ne bouge — l'état exact des trois panes mesurés
// le 2026-08-15, tous `done` avant, tous `done` après. On a remplacé le TRANSPORT (le binaire
// `herdr` sur le PATH, voir `aide/faux-herdr.js`) et laissé le vrai module rendre son verdict.
//
// ⚠️ Sans ça, l'essai « un pane muet ne compte pas comme remis » aurait été écrit contre un
// double qui décide lui-même de ce qu'est une remise réussie : on aurait prouvé que l'essai est
// d'accord avec lui-même.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { posteHerdr } from './aide/faux-herdr.js';
import { fauxSlack } from './aide/faux-slack.js';

let Veilleur, sauverRegistre, remettreVrai;
let racine;
let compteur = 0;

const PANE_ORCH = 'w0:p1';
const PANE_GEST = 'w1:p2';
const DIRIGEANT = { id: 'UDIR', courriel: 'd@somtech.ca' };

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-echo-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre } = await import('../src/registre.js'));
  ({ remettre: remettreVrai } = await import('../src/herdr.js'));
});
after(() => rmSync(racine, { recursive: true, force: true }));

/** Le lieu d'un représentant — son rôle s'établit par le FAIT, pas sur parole. */
function poserLieu(nom, entete) {
  const lieu = join(racine, `lieu-${nom}-${(compteur += 1)}`);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), `${entete}\n\nle métier.\n`);
  writeFileSync(join(lieu, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n\nle contexte.\n');
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

const LIGNE = {
  chantier: 'refonte-devis',
  canal_id: 'C_CHANTIER',
  canal_nom: 'chantier-refonte-devis',
  nature: 'interne',
  pane: PANE_ORCH,
  herdr_socket: null,
  pair: { nom: 'r-client', role: 'representant', pane: PANE_GEST, herdr_socket: null },
};

/**
 * Un poste complet : le VRAI `remettre` par-dessus un transport doublé.
 *
 * ⚠️ `agents` et `vivant` restent doublés — l'inventaire des sessions ne porte aucune preuve.
 * Ce qu'on refuse de doubler, c'est la logique qui décide si un message a été pris.
 */
async function avecPoste({ pane = {}, agents }, corps) {
  sauverRegistre({ version: 1, lignes: [LIGNE], communs: {}, commun: null, dirigeant: DIRIGEANT });
  const monde = fauxSlack({
    canaux: [{ id: 'C_CHANTIER', name: 'chantier-refonte-devis', is_private: true, membres: ['UMOI'] }],
    utilisateurs: [{ id: 'UMOI', name: 'ligne_directe', is_bot: true, profile: {} }],
    robot: 'UMOI',
    espace: 'T_ESSAIS',
  }).installer();

  const vivants = agents ?? [
    { pane_id: PANE_ORCH, name: 'orchestrateur', foreground_cwd: poserLieu('orch', "# Tu es l'orchestrateur de ce chantier") },
    { pane_id: PANE_GEST, name: 'r-client', foreground_cwd: poserLieu('gest', '# Tu es le représentant de ce client') },
  ];
  const poste = posteHerdr(racine, vivants, `p${(compteur += 1)}`);
  for (const a of vivants) poste.pane(a.pane_id, pane[a.pane_id] || {});

  const pathAvant = process.env.PATH;
  const etatAvant = process.env.FAUX_HERDR_ETAT;
  process.env.PATH = poste.path;
  process.env.FAUX_HERDR_ETAT = poste.etat;

  const v = new Veilleur({
    cheminSocket: join(racine, `v-${(compteur += 1)}.sock`),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T_ESSAIS', utilisateur: 'UMOI' },
    // LE VRAI VERDICT — `remettre` du module, pas une réimplémentation d'essai.
    herdr: { agents: poste.agents, vivant: poste.vivant, remettre: remettreVrai },
  });
  await v.ecouterLocal();
  try {
    return await corps({ veilleur: v, poste, monde });
  } finally {
    await v.arreter();
    monde.restaurer();
    process.env.PATH = pathAvant;
    if (etatAvant === undefined) delete process.env.FAUX_HERDR_ETAT;
    else process.env.FAUX_HERDR_ETAT = etatAvant;
  }
}

beforeEach(() => sauverRegistre({ version: 1, lignes: [LIGNE], communs: {}, commun: null, dirigeant: DIRIGEANT }));

// ═════════════════ 1. LA MOITIÉ QUI PROUVE — un écho dont la prise n'est pas constatée

test('UN PANE OÙ RIEN NE BOUGE N’EST PAS UN ÉCHO REMIS — c’est l’état des trois panes du 2026-08-15', async () => {
  // ⚠️ C'EST L'ESSAI DU LOT. L'appel réussit, la boîte est vide, et pourtant rien ne prouve que
  // l'agent a pris quoi que ce soit : même statut avant et après, même écran. Le message dort
  // peut-être dans la session. Avant ce lot, `echoAuPair` rendait `remis: true` ici — donc le
  // gestionnaire attendait une réponse à un message que personne n'avait lu.
  await avecPoste({ pane: { [PANE_GEST]: { statut: 'done', muet: true } } }, async ({ veilleur, poste }) => {
    const r = await veilleur.echoAuPair(LIGNE, PANE_ORCH, 'où en es-tu sur la migration ?');

    assert.equal(r.remis, false, 'la prise n’a pas été constatée : on ne dit pas « remis »');
    assert.match(r.raison, /pris|constat/i, 'et celui qui a parlé apprend POURQUOI');
    // ⚠️ Le message est bel et bien parti — c'est ce qui rend le cas piégeux : il n'y a pas
    // d'erreur à attraper. Ce qu'on refuse d'affirmer, c'est qu'il a été PRIS.
    assert.ok(poste.recu(PANE_GEST), 'le texte a bien été écrit dans le pane');
  });
});

test('UN PANE QUI GARDE LE TEXTE DANS SA BOÎTE NON PLUS — et ce n’est pas la même raison', async () => {
  // Distinct du muet, et il faut que les deux existent : ici on SAIT que ça n'est pas passé ;
  // là on ne sait rien. Les confondre ferait croire qu'un seul cas a été traité.
  await avecPoste({ pane: { [PANE_GEST]: { statut: 'idle', colle: true } } }, async ({ veilleur }) => {
    const r = await veilleur.echoAuPair(LIGNE, PANE_ORCH, 'la migration casse la table facture');

    assert.equal(r.remis, false);
    assert.match(r.raison, /boîte de saisie/i, 'la raison nomme le mode de panne, pas « erreur »');
  });
});

// ═════════════════ 2. ET IL DIT « REMIS » QUAND ÇA L'EST — la garde ne rend pas le geste inerte

test('UN ÉCHO PRIS PAR SON PAIR EST REMIS — sinon on aurait troqué un mensonge contre un refus', async () => {
  // La moitié qui empêche la garde de tout refuser. Un correctif qui rendrait `remis: false`
  // partout passerait l'essai précédent et casserait la ligne du chantier.
  await avecPoste({ pane: { [PANE_GEST]: { statut: 'idle' } } }, async ({ veilleur, poste }) => {
    const r = await veilleur.echoAuPair(LIGNE, PANE_ORCH, 'peux-tu me donner une échéance ?');

    assert.equal(r.remis, true, 'la session a quitté l’attente : la prise est constatée');
    assert.equal(r.nom, 'r-client', 'et on dit à qui');
    assert.match(poste.recu(PANE_GEST), /échéance/, 'le texte est arrivé');
  });
});

test('DANS L’AUTRE SENS AUSSI — le gestionnaire vers son orchestrateur', async () => {
  // ⚠️ « UNE PORTE SUR DEUX » : `echoAuPair` sert les DEUX sens de la ligne, et le verdict doit
  // valoir pour les deux. Un correctif posé sur la seule branche `versPair` laisserait le
  // compte rendu du gestionnaire mentir exactement comme avant.
  await avecPoste({ pane: { [PANE_ORCH]: { statut: 'done', muet: true } } }, async ({ veilleur }) => {
    const r = await veilleur.echoAuPair(LIGNE, PANE_GEST, 'j’ai ouvert le ticket, rien ne bloque');

    assert.equal(r.remis, false, 'l’orchestrateur non plus ne prend pas sur parole');
    assert.equal(r.pane, PANE_ORCH);
  });
});

// ═════════════════ 3. CE QUE LE VERDICT NE DOIT PAS AVALER

test('UNE REMISE QUI NE REND AUCUN VERDICT N’EST PAS UNE REMISE PROUVÉE — on exige le fait', async () => {
  // ⚠️ CET ESSAI GARDE LA FORME DE LA GARDE, ET IL A ÉTÉ ÉCRIT PARCE QU'ELLE NE L'ÉTAIT PAS :
  // relâcher `!remise?.pris` en `remise?.pris === false` laissait les 489 essais verts.
  //
  // La différence est tout le lot. `=== false` demande à `remettre` de DÉMENTIR la prise ;
  // s'il ne dit rien, on repart sur « remis ». C'est exactement ce que faisait l'ancien double
  // d'essai — `{ delivered: true }`, sans verdict — et c'est ainsi que ce défaut a survécu à
  // toute une suite verte. On exige donc le fait, pas l'absence de démenti.
  await avecPoste({ pane: { [PANE_GEST]: { statut: 'idle' } } }, async ({ veilleur }) => {
    veilleur.herdr.remettre = async () => ({ delivered: true }); // le double d'avant, tel quel
    const r = await veilleur.echoAuPair(LIGNE, PANE_ORCH, 'un mot qui compte');

    assert.equal(r.remis, false, 'sans verdict, on ne prétend rien');
  });
});

test('UN PANE REPRIS PAR UN AUTRE AGENT NE REÇOIT TOUJOURS RIEN — la garde d’avant tient', async () => {
  // Le verdict de prise s'ajoute aux gardes existantes, il ne les remplace pas : ici on ne
  // remet même pas, donc il n'y a rien à constater. Une régression ici serait une fuite.
  const agents = [
    { pane_id: PANE_ORCH, name: 'orchestrateur', foreground_cwd: poserLieu('orch', "# Tu es l'orchestrateur de ce chantier") },
    { pane_id: PANE_GEST, name: 'quelqu-un-dautre', foreground_cwd: poserLieu('gest', '# Tu es le représentant de ce client') },
  ];
  await avecPoste({ agents, pane: { [PANE_GEST]: { statut: 'idle' } } }, async ({ veilleur, poste }) => {
    const r = await veilleur.echoAuPair(LIGNE, PANE_ORCH, 'le fil technique du chantier');

    assert.equal(r.remis, false);
    assert.equal(poste.recu(PANE_GEST), null, 'et RIEN n’a été écrit dans ce pane');
  });
});

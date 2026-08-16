// LE CANAL COMMUN — une consigne du dirigeant atteint TOUS les agents qui travaillent déjà,
// et rien ne repart jamais dans l'autre sens (T-20260813-0075).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER GARDE, ET POURQUOI IL EST ÉCRIT AINSI
//
// Le lot est, par construction, une SECONDE ÉCOUTE sur un pane qui en a déjà une — la
// configuration que le métier du gestionnaire client interdit en une phrase : « deux lignes
// sur un même pane font partir les messages dans le mauvais canal ».
//
// LE DÉFAUT A ÉTÉ MESURÉ AVANT DE CONCEVOIR (2026-08-13, contre le vrai code, faux Slack en
// place), et il n'est ni dans le registre, ni dans le veilleur, ni chez Slack :
//
//   • chemin SORTANT — la commande choisit la ligne dont elle parle avec un `.find()` sur le
//     pane, une clé qui n'est PAS unique. Deux lignes ouvertes depuis le même pane, et elle
//     rend la première inscrite : un rapport destiné à `D-2` est parti dans le canal de `D-1`,
//     avec `ok:true`, sans un mot. Ce n'est pas une panne — c'est une déduction qui ne peut
//     pas savoir qu'elle avait le choix ;
//   • chemin ENTRANT — sain, et le premier test de ce fichier l'ÉTABLIT plutôt que de le
//     supposer : il route par `ev.channel`, clé unique par ligne ouverte.
//
// D'où la conception, et ce fichier la garde par le fait :
//   1. le canal commun n'entre PAS dans `lignes[]`, donc jamais dans `etat().ouvertes`, donc
//      jamais dans la sélection par pane — il n'est candidat à aucun geste sortant ;
//   2. personne ne s'y abonne : le veilleur demande à herdr qui travaille et remet à chacun.
//      Aucune écoute ajoutée sur aucun pane, aucune structure de ligne touchée ;
//   3. les gestes qui écrivent le refusent nommément, quelle que soit la porte.
//
// LES PREUVES SONT DES FAITS, JAMAIS DES MESSAGES. Les agents de ce fichier ÉCRIVENT un
// fichier quand ils reçoivent — on lit ce qu'ils ont fait, pas ce que le veilleur prétend
// avoir envoyé. Et « rien ne repart » se prouve par l'ABSENCE côté Slack (`monde.postes`),
// jamais par le texte d'un refus.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI A CHANGÉ AVEC T-20260814-0002, ET CE QUI N'A PAS BOUGÉ
//
// Le canal est désormais désigné POUR UN RÔLE, et n'atteint que les agents de ce rôle. Les
// preuves ci-dessous portent donc toutes un rôle, et leurs agents tournent depuis un vrai LIEU
// d'orchestrateur — sans quoi ils n'auraient plus de rôle établi et ne recevraient rien, ce qui
// ferait passer ce fichier pour vert en ne prouvant plus rien du tout.
//
// CE FICHIER GARDE CE QUI N'EST PAS PROPRE AUX RÔLES : le routage entrant, la reprise d'un
// message, les trois silences, le filtre des robots par la vraie porte d'entrée, la résolution
// des autorisés. Ce qui distingue les rôles — qui reçoit quoi, le chef d'équipe qui ne reçoit
// rien, les gardes rejouées sur plusieurs canaux — vit dans `canal-par-role.test.js`.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';

let Veilleur, sauverRegistre, chargerRegistre, ligneDuPane, canalCommunDuRole;
let racine;
let compteur = 0;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-commun-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre, ligneDuPane, canalCommunDuRole } = await import('../src/registre.js'));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [], communs: {}, commun: null }));

const ANNONCES = { id: 'C_ANNONCES', name: 'annonces-agents', is_private: false, membres: ['UMOI', 'UDIR'] };
const DIRIGEANT = 'UDIR';
/** Le rôle sous lequel ce fichier désigne son canal — le choix n'y change rien, il en faut un. */
const ROLE = 'orchestrateur';

/** Le canal désigné pour `ROLE`, ou `null` — la lecture qui remplace l'ancien `canalCommun`. */
const designe = () => canalCommunDuRole(chargerRegistre(), ROLE);

/**
 * Un LIEU d'orchestrateur sur disque, tel que la pose l'aurait laissé.
 *
 * Les agents de ce fichier en ont un depuis T-20260814-0002 : un agent sans lieu n'a plus de
 * rôle établi, donc ne reçoit plus rien — et chaque preuve de diffusion d'ici passerait au vert
 * en ne prouvant rien. Les en-têtes sont ceux des vrais gabarits.
 */
function lieuDOrchestrateur() {
  const chemin = join(racine, `lieu-${(compteur += 1)}`);
  mkdirSync(join(chemin, '.claude'), { recursive: true });
  writeFileSync(join(chemin, 'CLAUDE.md'), "# Tu es l'orchestrateur de ce chantier\n");
  writeFileSync(join(chemin, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n');
  writeFileSync(join(chemin, '.mcp.json'), '{"mcpServers":{}}\n');
  writeFileSync(join(chemin, '.claude', 'settings.json'), '{"permissions":{"allow":[]}}\n');
  return chemin;
}

/** Monte un espace Slack en mémoire pour la durée d'un test, et le démonte quoi qu'il arrive. */
async function avecSlack(etat, corps) {
  const monde = fauxSlack(etat).installer();
  try {
    return await corps(monde);
  } finally {
    monde.restaurer();
  }
}

/**
 * Des agents qui TRAVAILLENT — et dont on lira ce qu'ils ont fait, pas ce qu'on leur a envoyé.
 *
 * C'est la différence entre prouver et se rassurer : un double qui se contente d'empiler les
 * appels reçus laisse passer un cadre tronqué, un message remis au mauvais pane, ou une remise
 * que herdr aurait refusée. Ici, recevoir a un EFFET sur le disque, et c'est l'effet qu'on lit.
 */
function agentsQuiTravaillent({ panes = ['w1:p1'], refuse = [] } = {}) {
  const dossier = join(racine, `travail-${(compteur += 1)}`);
  mkdirSync(dossier, { recursive: true });
  // Chacun son lieu, et un lieu RÉEL : c'est lui, et lui seul, qui établit son rôle.
  const lieux = new Map(panes.map((p) => [p, lieuDOrchestrateur()]));
  return {
    dossier,
    fichier: (pane) => join(dossier, `${pane.replace(/[^a-z0-9]/gi, '_')}.txt`),
    async vivant(pane) {
      return panes.includes(pane);
    },
    async remettre(pane, texte) {
      if (refuse.includes(pane)) throw new Error(`pane ${pane} injoignable`);
      const cible = this.fichier(pane);
      rmSync(cible, { force: true });
      writeFileSync(cible, texte);
      // ⚠️ CE DOUBLE AFFIRME LA PRISE, ET IL LE FAIT SCIEMMENT (T-20260815-0021). Le vrai
      // `remettre()` rend `{ pris, temoin }` ; un double qui l'omettait était plus permissif
      // que le service, et c'est la porte par laquelle un « remis » non prouvé passait. Ces
      // essais portent sur le ROUTAGE — qui reçoit quoi — pas sur la preuve de prise, qui a
      // ses propres essais. On déclare donc la prise plutôt que de la taire.
      return { delivered: true, pris: true, temoin: 'sortie-de-l-attente' };
    },
    async agents() {
      return panes.map((p) => ({
        agent: 'claude',
        pane_id: p,
        foreground_cwd: lieux.get(p),
        herdr_socket: `/s/${p}`,
      }));
    },
  };
}

const veilleur = (opts = {}) =>
  new Veilleur({
    cheminSocket: join(racine, `${(compteur += 1)}.sock`),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    ...opts,
  });

function ligne({ chantier, canalId, canalNom, pane, worktree = '/w', nature = 'interne', libelle }) {
  return {
    chantier,
    canal_id: canalId,
    canal_nom: canalNom,
    pane,
    worktree,
    nature,
    libelle: libelle || chantier,
    autorises: nature === 'client' ? ['UCLIENT'] : [DIRIGEANT],
    visage: '🧭',
    ouverte_le: 'hier',
    close_le: null,
  };
}

// ═════════════════ 0. LE ROUTAGE ENTRANT — établi, pas supposé

test('ENTRANT — deux lignes sur un MÊME pane : chaque message arrive cadré de SA ligne', async () => {
  // Le chemin sortant est établi comme fautif (mesuré). Celui-ci ne se déduit pas de celui-là :
  // il faut le regarder. Il route par `ev.channel`, qui est unique par ligne ouverte — et c'est
  // ce qui rend une SECONDE écoute descendante possible sans rejouer le défaut.
  sauverRegistre({
    version: 1,
    communs: {},
    commun: null,
    lignes: [
      ligne({ chantier: 'D-1', canalId: 'C_d1', canalNom: 'd-1', pane: 'w1:p1', worktree: '/w/a' }),
      ligne({ chantier: 'D-2', canalId: 'C_d2', canalNom: 'd-2', pane: 'w1:p1', worktree: '/w/b' }),
    ],
  });
  const travail = agentsQuiTravaillent({ panes: ['w1:p1'] });
  const v = veilleur({ herdr: travail, slack: { async poster() { return '1.0'; } } });

  await v.remettreAuChantier({ channel: 'C_d2', user: DIRIGEANT, text: 'ceci est pour D-2' });
  const pourD2 = readFileSync(travail.fichier('w1:p1'), 'utf8');
  assert.match(pourD2, /^\[LIGNE DIRECTE — D-2 \(#d-2\)\]/, `cadre reçu : ${pourD2.split('\n')[0]}`);

  await v.remettreAuChantier({ channel: 'C_d1', user: DIRIGEANT, text: 'ceci est pour D-1' });
  const pourD1 = readFileSync(travail.fichier('w1:p1'), 'utf8');
  assert.match(pourD1, /^\[LIGNE DIRECTE — D-1 \(#d-1\)\]/, `cadre reçu : ${pourD1.split('\n')[0]}`);
});

// ═════════════════ 1. LA DÉSIGNATION — on ne crée pas ce canal, on le désigne

test('DÉSIGNER — le canal doit exister, et notre robot y être invité', async () => {
  await avecSlack({ canaux: [] }, async () => {
    const v = veilleur();
    const absent = await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });
    assert.equal(absent.ok, false);
    assert.equal(absent.motif, 'absent');
    assert.equal(designe(), null, 'un refus n’inscrit rien');
  });

  await avecSlack({ canaux: [{ ...ANNONCES, membres: [DIRIGEANT] }] }, async () => {
    const v = veilleur();
    const dehors = await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });
    assert.equal(dehors.ok, false);
    assert.equal(dehors.motif, 'non_membre', 'un robot ne se met pas lui-même dans un canal');
    assert.equal(designe(), null);
  });

  await avecSlack({ canaux: [ANNONCES] }, async () => {
    const v = veilleur();
    const ok = await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });
    assert.equal(ok.ok, true);
    assert.equal(designe().canal_id, 'C_ANNONCES');
  });
});

test('DÉSIGNER — un canal ARCHIVÉ est refusé : il a l’air posé, et aucune consigne n’en part jamais', async () => {
  // Relevé en revue de fond. `trouverCanal` cherche archives comprises (`exclude_archived:
  // false`), et le robot reste membre d'un canal archivé — les deux garde-fous existants
  // laissaient donc passer. Le résultat était le pire des trois : `ok:true`, canal désigné,
  // et le silence total sur le canal censé réveiller tout le poste.
  await avecSlack({ canaux: [{ ...ANNONCES, is_archived: true }] }, async () => {
    const v = veilleur();
    const r = await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });
    assert.equal(r.ok, false, 'un canal archivé ne se désigne pas');
    assert.equal(r.motif, 'archive');
    assert.equal(designe(), null, 'et rien n’est inscrit');
  });
});

test('DÉSIGNER — sans autorisé, rien n’est désigné : tout l’espace parlerait à tous les agents', async () => {
  await avecSlack({ canaux: [ANNONCES] }, async () => {
    const v = veilleur();
    const r = await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [] });
    assert.equal(r.ok, false);
    assert.equal(designe(), null);
  });
});

test('DÉSIGNER — un canal qui porte déjà une ligne est refusé (le client parlerait à tout le poste)', async () => {
  sauverRegistre({
    version: 1,
    communs: {},
    commun: null,
    lignes: [ligne({ chantier: 'acme', canalId: 'C_ANNONCES', canalNom: 'annonces-agents', pane: 'w1:p1', nature: 'client' })],
  });
  await avecSlack({ canaux: [ANNONCES] }, async () => {
    const v = veilleur();
    const r = await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });
    assert.equal(r.ok, false);
    assert.equal(designe(), null);
  });
});

// ═════════════════ 2. LA CONSIGNE ATTEINT CEUX QUI TRAVAILLENT — par le fait

test('DIFFUSER — deux agents au travail, deux agents qui AGISSENT sur ce qu’ils ont reçu', async () => {
  const travail = agentsQuiTravaillent({ panes: ['w1:p1', 'w2:p7'] });

  await avecSlack({ canaux: [ANNONCES] }, async (monde) => {
    const v = veilleur({ herdr: travail });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });

    await v.remettreAuChantier({
      channel: 'C_ANNONCES',
      user: DIRIGEANT,
      text: 'Merci de mettre à jour vos configurations dès que possible, le pack a été mis à jour.',
    });

    for (const pane of ['w1:p1', 'w2:p7']) {
      assert.ok(existsSync(travail.fichier(pane)), `${pane} n’a rien fait de ce qu’il a reçu`);
      const recu = readFileSync(travail.fichier(pane), 'utf8');
      assert.match(recu, /mettre à jour vos configurations/, 'la consigne doit arriver ENTIÈRE');
      assert.match(recu, /^\[CANAL COMMUN — À TOUS LES ORCHESTRATEURS \(#annonces-agents\)\]/);
    }

    // Et rien n'est reparti : le canal commun ne porte que la parole du dirigeant.
    assert.deepEqual(monde.postes, [], 'la diffusion ne doit RIEN poster dans Slack');
  });
});

test('DIFFUSER — un agent SANS ligne entend quand même : il n’a rien eu à faire pour cela', async () => {
  // La question était ouverte : « un agent sans ligne — il entend, ou il est hors périmètre ? »
  // Il entend. C'est la conséquence directe de l'absence d'abonnement, et c'est ce qui fait
  // tenir « tous les agents » plutôt que « tous ceux qui ont pensé à s'inscrire ».
  const travail = agentsQuiTravaillent({ panes: ['w3:pSANS-LIGNE'] });

  await avecSlack({ canaux: [ANNONCES] }, async () => {
    const v = veilleur({ herdr: travail });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });
    assert.deepEqual(chargerRegistre().lignes, [], 'aucune ligne au registre : cet agent n’en a pas');

    await v.remettreAuChantier({ channel: 'C_ANNONCES', user: DIRIGEANT, text: 'Un nouveau MCP est disponible.' });
    assert.match(readFileSync(travail.fichier('w3:pSANS-LIGNE'), 'utf8'), /nouveau MCP/);
  });
});

test('DIFFUSER — un pane injoignable n’empêche AUCUN autre agent de recevoir', async () => {
  const travail = agentsQuiTravaillent({ panes: ['w1:mort', 'w2:vivant'], refuse: ['w1:mort'] });

  await avecSlack({ canaux: [ANNONCES] }, async (monde) => {
    const v = veilleur({ herdr: travail });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });
    const bilan = await v.diffuserConsigne({ channel: 'C_ANNONCES', user: DIRIGEANT, text: 'consigne' });

    assert.equal(bilan.remis, 1);
    assert.deepEqual(bilan.echecs, ['w1:mort']);
    assert.ok(existsSync(travail.fichier('w2:vivant')), 'le pane vivant devait recevoir malgré l’autre');
    assert.deepEqual(monde.postes, [], 'un échec ne se raconte pas dans le canal commun');
  });
});

test('DIFFUSER — une consigne REPRISE par son auteur est rediffusée', async () => {
  const travail = agentsQuiTravaillent({ panes: ['w1:p1'] });

  await avecSlack({ canaux: [ANNONCES] }, async () => {
    const v = veilleur({ herdr: travail });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });

    await v.remettreLaReprise({
      channel: 'C_ANNONCES',
      previous_message: { user: DIRIGEANT, text: 'mettez à jour' },
      message: { user: DIRIGEANT, text: 'mettez à jour — version 1.40 précisément' },
    });
    const recu = readFileSync(travail.fichier('w1:p1'), 'utf8');
    assert.match(recu, /version 1\.40/);
    assert.match(recu, /MODIFIÉ depuis son envoi/);
  });
});

test('DIFFUSER — un membre NON autorisé ne parle pas à tous les agents', async () => {
  const travail = agentsQuiTravaillent({ panes: ['w1:p1'] });

  await avecSlack({ canaux: [ANNONCES] }, async (monde) => {
    const v = veilleur({ herdr: travail });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });

    await v.remettreAuChantier({ channel: 'C_ANNONCES', user: 'UQUELQUUN', text: 'redémarrez tout' });
    assert.equal(existsSync(travail.fichier('w1:p1')), false, 'aucun agent ne doit avoir agi');
    assert.deepEqual(monde.postes, [], 'et on ne lui répond pas DANS le canal de tous les agents');
  });
});

test('DIFFUSER — les trois silences : rien à dire, herdr muet, personne au travail', async () => {
  // Trois branches qui se terminent SANS remise ET SANS un mot dans le canal. Elles ne sont pas
  // des oublis : c'est le choix assumé de ne rien déverser dans un canal d'urgence (RA-REL-008).
  // Ce qu'on éprouve ici, c'est qu'elles ne LÈVENT pas et n'écrivent nulle part — un rejet qui
  // s'échappe de ce chemin met le veilleur à terre, et l'enveloppe Slack est déjà acquittée :
  // le message serait perdu définitivement, en silence.
  await avecSlack({ canaux: [ANNONCES] }, async (monde) => {
    // 1. Un message qui ne porte QU'UNE pièce jointe : les pièces ne suivent pas ce canal.
    const sansTexte = agentsQuiTravaillent({ panes: ['w1:p1'] });
    const v1 = veilleur({ herdr: sansTexte });
    await v1.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });
    await v1.remettreAuChantier({ channel: 'C_ANNONCES', user: DIRIGEANT, text: '   ', files: [{ id: 'F1' }] });
    assert.equal(existsSync(sansTexte.fichier('w1:p1')), false, 'rien ne devait être remis');

    // 2. herdr injoignable — on reporte, on ne conclut pas que le poste est vide.
    const herdrMuet = {
      ...agentsQuiTravaillent(),
      async agents() {
        throw new Error('herdr introuvable dans le PATH');
      },
    };
    const v2 = veilleur({ herdr: herdrMuet });
    assert.equal(await v2.diffuserConsigne({ channel: 'C_ANNONCES', user: DIRIGEANT, text: 'consigne' }), undefined);

    // 3. Personne au travail en ce moment.
    const desert = { ...agentsQuiTravaillent(), async agents() { return []; } };
    const v3 = veilleur({ herdr: desert });
    assert.equal(await v3.diffuserConsigne({ channel: 'C_ANNONCES', user: DIRIGEANT, text: 'consigne' }), undefined);

    assert.deepEqual(monde.postes, [], 'et aucun des trois silences ne parle dans le canal');
  });
});

// ═════════════════ 3. RIEN NE REPART — prouvé par l'absence côté Slack

test('DESCENDANT — « dire », « fermer » et « renommer » sont refusés sur le canal commun, et RIEN n’est posté', async () => {
  await avecSlack({ canaux: [ANNONCES] }, async (monde) => {
    const v = veilleur({ herdr: agentsQuiTravaillent() });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });

    const dit = await v.dire({ canal_id: 'C_ANNONCES', texte: 'un agent qui parle à tout le monde' });
    const ferme = await v.fermer({ canal_id: 'C_ANNONCES', bilan: 'bilan de chantier' });
    const renomme = await v.renommer({ canal_id: 'C_ANNONCES', titre: 'autre chose' });

    assert.equal(dit.ok, false);
    assert.equal(ferme.ok, false);
    assert.equal(renomme.ok, false);

    // LA PREUVE EST L'ABSENCE, jamais le texte du refus : aucun message n'a atteint Slack, et
    // le canal n'a été ni renommé ni archivé.
    assert.deepEqual(monde.postes, [], 'aucun message ne doit être parti dans le canal commun');
    assert.equal(monde.canalNomme('annonces-agents').is_archived, false, 'le canal commun ne s’archive pas');
    assert.equal(monde.canalNomme('annonces-agents').name, 'annonces-agents', 'ni ne se renomme');
    assert.equal(designe().canal_id, 'C_ANNONCES', 'et il reste désigné');
  });
});

test('DESCENDANT — même avec une LIGNE HÉRITÉE sur ce canal, rien n’en repart', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // CE TEST EXISTE PARCE QUE LE PRÉCÉDENT NE GARDAIT RIEN — vérifié par mutation : on
  // supprimait les refus de `dire` et `fermer`, et les quatorze tests restaient verts. Ils
  // passaient par accident : sans ligne sur ce canal, `dire` refusait déjà de lui-même
  // (« aucune ligne ouverte »), et l'absence de message côté Slack ne prouvait donc rien.
  //
  // L'état ci-dessous n'est pas une curiosité de laboratoire : LE REGISTRE SURVIT AUX VERSIONS
  // DU PACK. Une ligne inscrite sur ce canal par une version qui ignorait le canal commun y
  // reste après la mise à jour — la version courante refuse de la créer, elle ne peut pas
  // l'effacer. Et c'est l'état où le refus compte vraiment : `fermer` aurait posté son bilan
  // dans le canal de TOUS les agents, puis l'aurait ARCHIVÉ, c'est-à-dire mis en lecture seule
  // sans retour possible avec le jeton dont nous disposons.
  sauverRegistre({
    version: 1,
    commun: { canal_id: 'C_ANNONCES', canal_nom: 'annonces-agents', autorises: [DIRIGEANT], designe_le: 'hier' },
    lignes: [ligne({ chantier: 'D-7', canalId: 'C_ANNONCES', canalNom: 'annonces-agents', pane: 'w1:p1', worktree: '/w/h' })],
  });

  await avecSlack({ canaux: [ANNONCES] }, async (monde) => {
    const v = veilleur({ herdr: agentsQuiTravaillent() });

    // Par le canal, ET par le chantier — c'est le second chemin qui manquait.
    const parCanal = await v.dire({ canal_id: 'C_ANNONCES', texte: 'un agent qui parle à tout le monde' });
    const parChantier = await v.dire({ chantier: 'D-7', worktree: '/w/h', texte: 'rapport de chantier' });
    const ferme = await v.fermer({ chantier: 'D-7', worktree: '/w/h', bilan: 'bilan de fin de chantier' });
    const renomme = await v.renommer({ chantier: 'D-7', worktree: '/w/h', titre: 'autre chose' });

    assert.equal(parCanal.ok, false);
    assert.equal(parChantier.ok, false, 'le chemin par CHANTIER est refusé lui aussi');
    assert.equal(ferme.ok, false);
    assert.equal(renomme.ok, false);

    assert.deepEqual(monde.postes, [], 'aucune parole d’agent ne doit atteindre le canal de tous');
    assert.equal(monde.canalNomme('annonces-agents').is_archived, false, 'et il n’est pas archivé');
    assert.equal(monde.canalNomme('annonces-agents').name, 'annonces-agents', 'ni renommé');
  });
});

test('DESCENDANT — aucune ligne ne s’installe sur le canal commun, même par collision de nom', async () => {
  // Le nom d'un canal vient du TITRE, la normalisation aplatit tout, et `creerCanal` REPREND un
  // canal homonyme au lieu d'échouer. Sans garde, un chantier titré « Annonces agents » hérite
  // du canal de tous — et tout ce que cet agent dit part chez tout le monde.
  await avecSlack({ canaux: [ANNONCES] }, async (monde) => {
    const v = veilleur({ herdr: agentsQuiTravaillent() });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });

    const r = await v.ouvrir({ chantier: 'D-9', titre: 'Annonces agents', pane: 'w1:p1', worktree: '/w', invites: [DIRIGEANT] });
    assert.equal(r.ok, false, `l’ouverture aurait dû être refusée, obtenu : ${JSON.stringify(r)}`);
    assert.deepEqual(chargerRegistre().lignes, [], 'et rien ne doit être inscrit au registre');
    assert.deepEqual(monde.postes, [], 'ni annoncé dans le canal');
  });
});

// ═════════════════ 4. LA LIGNE PROPRE RESTE INTACTE — la garde la plus importante

test('LIGNE PROPRE — le canal commun n’est JAMAIS candidat à la sélection par pane', async () => {
  // La preuve passe par `ligneDuPane`, LA FONCTION QUE LA COMMANDE APPELLE. Un test qui
  // réécrirait ce filtre prouverait seulement qu'il est d'accord avec lui-même.
  sauverRegistre({
    version: 1,
    communs: {},
    commun: null,
    lignes: [ligne({ chantier: 'acme', canalId: 'C_acme', canalNom: 'acme', pane: 'w1:p1', nature: 'client', libelle: 'Acme' })],
  });
  await avecSlack({ canaux: [ANNONCES, { id: 'C_acme', name: 'acme', is_private: true, membres: ['UMOI', 'UCLIENT'] }] }, async (monde) => {
    const travail = agentsQuiTravaillent({ panes: ['w1:p1'] });
    const v = veilleur({ herdr: travail });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });

    // L'agent reçoit la consigne commune — c'est le moment où « il a rejoint le canal commun ».
    await v.remettreAuChantier({ channel: 'C_ANNONCES', user: DIRIGEANT, text: 'mettez à jour vos configurations' });
    assert.match(readFileSync(travail.fichier('w1:p1'), 'utf8'), /CANAL COMMUN/);

    const etat = v.etat();
    assert.equal(etat.ouvertes.length, 1, '`ouvertes` ne porte que des LIGNES');
    assert.deepEqual(
      etat.communs.map((c) => c.canal),
      ['annonces-agents'],
      'le canal commun est rendu À CÔTÉ'
    );

    // La sélection de la commande, telle quelle :
    const { ligne: mienne, candidates } = ligneDuPane(etat.ouvertes, 'w1:p1');
    assert.equal(candidates.length, 1, 'un seul candidat : le canal commun n’en est pas un');
    assert.equal(mienne.chantier, 'acme');

    // Et ce que le représentant répond part chez SON client, pas chez tous les agents.
    await v.dire({ chantier: mienne.chantier, worktree: mienne.worktree, texte: 'Bonjour, c’est noté.' });
    assert.deepEqual(
      monde.postes.map((p) => p.channel),
      ['C_acme'],
      'la réponse au client ne doit toucher QUE le canal du client'
    );
  });
});

test('LIGNE PROPRE — après la consigne commune, un message du client arrive toujours cadré de SA ligne', async () => {
  sauverRegistre({
    version: 1,
    communs: {},
    commun: null,
    lignes: [ligne({ chantier: 'acme', canalId: 'C_acme', canalNom: 'acme', pane: 'w1:p1', nature: 'client', libelle: 'Acme' })],
  });
  const canalClient = { id: 'C_acme', name: 'acme', is_private: true, membres: ['UMOI', 'UCLIENT'] };
  await avecSlack({ canaux: [ANNONCES, canalClient], utilisateurs: [{ id: 'UCLIENT', name: 'jean', profile: {} }] }, async () => {
    const travail = agentsQuiTravaillent({ panes: ['w1:p1'] });
    const v = veilleur({ herdr: travail });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });

    await v.remettreAuChantier({ channel: 'C_ANNONCES', user: DIRIGEANT, text: 'mettez à jour vos configurations' });
    await v.remettreAuChantier({ channel: 'C_acme', user: 'UCLIENT', text: 'Bonjour, une question.' });

    const dernier = readFileSync(travail.fichier('w1:p1'), 'utf8');
    assert.match(dernier, /^\[LIGNE DIRECTE — acme \(#acme\)\] Message de /, `cadre reçu : ${dernier.split('\n')[0]}`);
    assert.match(dernier, /du client/, 'et il reste un message DU CLIENT, pas une consigne du dirigeant');
  });
});

// ═════════════════ 5. LE CADRE — ce qui empêche un représentant de répondre au client

test('CADRE — la consigne ne peut pas être prise pour la parole de l’interlocuteur de la ligne', async () => {
  // C'est le point soulevé par le dirigeant : « le canal écrit dans le pane, mais le
  // gestionnaire ne le connaît pas ». Si l'agent ignore que ce canal existe, il n'a qu'une
  // explication pour un texte qui apparaît — c'est mon interlocuteur qui parle. Chez un
  // gestionnaire, cet interlocuteur est LE CLIENT, et le réflexe est de lui répondre.
  const { cadrerConsigneCommune, cadrerPourAgent, COMMANDE } = await import('../src/cadre.js');
  const commun = cadrerConsigneCommune({ texte: 'mettez à jour vos configurations', canal: 'annonces-agents' });
  const surUneLigne = cadrerPourAgent({ chantier: 'acme', texte: 'bonjour', canal: 'acme', nature: 'client', auteur: 'Jean' });

  // Assertion CROISÉE : ce qui invite à répondre sur une ligne doit être ABSENT ici.
  assert.match(surUneLigne, /Réponds-lui avec/, 'le cadre d’une ligne invite bien à répondre…');
  assert.ok(!commun.includes('Réponds-lui'), '…et celui d’une consigne commune ne doit PAS le faire');
  assert.ok(!commun.includes(`${COMMANDE} dire`), 'aucune commande d’écriture ne doit y figurer');
  assert.ok(!commun.startsWith('[LIGNE DIRECTE'), 'ni emprunter la signature visuelle d’un interlocuteur');

  assert.match(commun, /Consigne du dirigeant/, 'il dit d’où ça vient');
  assert.match(commun, /TOUS les agents/, 'et que ça vaut pour tous');
  assert.match(commun, /ON N'Y RÉPOND PAS/, 'et qu’on n’y répond pas');
});

// ═════════════════ 6. LA COMMANDE — la liste des autorisés ne s'ampute pas en silence

test('COMMANDE — un nom qui ne se résout pas fait échouer la désignation ENTIÈRE', async () => {
  // Relevé en revue de fond : cette boucle vivait dans `bin/`, exercée par rien. Ni les tests
  // du veilleur (qui reçoivent une liste déjà résolue), ni ceux de la lecture d'arguments (qui
  // s'arrêtent avant). Le reviewer a supprimé le refus : les 313 tests sont restés verts.
  //
  // Ce qu'on garde ici est le pire des trois résultats possibles : le canal désigné, tout ayant
  // l'air en place, et la personne qui manque s'entendant refuser la parole sans que rien ne le
  // dise. On éprouve la résolution contre le VRAI annuaire du double, pas contre une injection.
  const { resoudreAutorises } = await import('../src/canal-commun.js');
  const annuaire = [
    { id: 'UDIR', name: 'maxime', real_name: 'Maxime', profile: { email: 'maxime.leboeuf@somtech.ca' } },
  ];

  await avecSlack({ canaux: [ANNONCES], utilisateurs: annuaire }, async () => {
    const seul = await resoudreAutorises('xoxb-x', ['maxime.leboeuf@somtech.ca']);
    assert.deepEqual(seul, { ok: true, autorises: ['UDIR'] });

    // L'inconnu en SECOND : les précédents sont déjà résolus, et c'est là que la tentation
    // d'inscrire « ce qu'on a » est la plus forte.
    const ampute = await resoudreAutorises('xoxb-x', ['maxime.leboeuf@somtech.ca', 'parti@somtech.ca']);
    assert.deepEqual(ampute, { ok: false, inconnu: 'parti@somtech.ca' }, 'aucune liste partielle ne sort d’ici');

    // Et en PREMIER : on n'interroge pas l'annuaire pour les suivants, on s'arrête.
    const dabord = await resoudreAutorises('xoxb-x', ['parti@somtech.ca', 'maxime.leboeuf@somtech.ca']);
    assert.deepEqual(dabord, { ok: false, inconnu: 'parti@somtech.ca' });
  });
});

test('TRAME — un message de robot dans le canal commun ne fait rien faire à personne', async () => {
  // Dernier chemin de rupture listé en revue, et il passe par la VRAIE porte d'entrée
  // (`traiterTrame`), pas par la méthode de diffusion : c'est le seul moyen de prouver que les
  // filtres d'amont s'appliquent aussi à ce canal. Un robot d'intégration qui poste un rapport
  // dans le canal des annonces — un déploiement, une alerte de dépôt — réveillerait sinon tous
  // les agents du poste sous le cadre « consigne du dirigeant ».
  const travail = agentsQuiTravaillent({ panes: ['w1:p1'] });
  await avecSlack({ canaux: [ANNONCES] }, async (monde) => {
    const v = veilleur({ herdr: travail });
    await v.designerCommun({ canal: 'annonces-agents', role: ROLE, autorises: [DIRIGEANT] });

    const trame = (event) => ({ data: JSON.stringify({ type: 'events_api', payload: { event } }) });
    const ws = { send() {}, close() {} };

    await v.traiterTrame(trame({ type: 'message', channel: 'C_ANNONCES', bot_id: 'B9', text: 'déploiement terminé' }), ws);
    assert.equal(existsSync(travail.fichier('w1:p1')), false, 'un robot ne parle pas à tous les agents');

    // LE CAS QUI DÉPARTAGE LES DEUX GARDES, et il a fallu une mutation pour le trouver : le
    // refus ci-dessus tient par l'AUTORISATION (un message de robot n'a pas d'auteur), pas par
    // le filtre des robots — supprimer `if (ev.bot_id) return` ne faisait rougir personne.
    //
    // Une application Slack qui poste AU NOM de quelqu'un — un flux de travail, une intégration
    // de dépôt — rend une trame qui porte `bot_id` ET l'auteur humain. L'auteur est alors
    // autorisé, et seul le filtre des robots reste entre une notification automatique et le
    // pane de TOUS les agents du poste, sous le cadre « consigne du dirigeant ».
    await v.traiterTrame(
      trame({ type: 'message', channel: 'C_ANNONCES', bot_id: 'B9', user: DIRIGEANT, text: 'build #412 échoué' }),
      ws
    );
    assert.equal(
      existsSync(travail.fichier('w1:p1')),
      false,
      'un robot qui poste au nom du dirigeant ne réveille pas le poste'
    );

    // Et le veilleur lui-même, s'il se relisait : impossible par construction (il n'écrit jamais
    // ici), mais le filtre doit tenir quand même.
    await v.traiterTrame(trame({ type: 'message', channel: 'C_ANNONCES', user: 'UMOI', text: 'écho' }), ws);
    assert.equal(existsSync(travail.fichier('w1:p1')), false);

    // La même trame, du dirigeant, passe : c'est ce qui rend les deux refus ci-dessus lisibles.
    await v.traiterTrame(trame({ type: 'message', channel: 'C_ANNONCES', user: DIRIGEANT, text: 'mettez à jour' }), ws);
    assert.match(readFileSync(travail.fichier('w1:p1'), 'utf8'), /mettez à jour/);
    assert.deepEqual(monde.postes, []);
  });
});

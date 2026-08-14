// UN CANAL COMMUN PAR RÔLE — et le canal n'atteint QUE les agents dont le rôle est établi
// par le fait (T-20260814-0002).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER GARDE, ET POURQUOI IL EST ÉCRIT AINSI
//
// Le lot précédent (`T-20260813-0075`) remettait à TOUS les agents que herdr rapporte. La
// source a corrigé : on parle aux orchestrateurs et aux gestionnaires, jamais aux chefs
// d'équipe — c'est leur orchestrateur qui leur retransmet ce qui les concerne.
//
// LA QUESTION DU LOT EST DONC « COMMENT SAIT-ON À QUI REMETTRE », et la réponse ne peut pas
// être une convention de nommage : le nom d'un agent herdr est une chaîne libre, que
// n'importe qui écrit. Ce qui l'établit PAR LE FAIT, c'est le lieu depuis lequel il tourne —
// les quatre fichiers que la pose y dépose, et les EN-TÊTES RÉELS de son métier. C'est déjà
// ce sur quoi reposent le garde d'ouverture de ligne et le réveil horaire ; ce lot ne monte
// pas un troisième mécanisme, il appelle celui-là.
//
// ⚠️ LE DÉFAUT EST LE SILENCE, PAS LA DIFFUSION. Un agent dont le rôle ne s'établit pas ne
// reçoit rien. C'est le mode de panne de `D-20260813-0001` §1 qu'on refuse de rejouer : des
// consignes exécutées qui ne venaient de personne, jusqu'à cinq sur six.
//
// LES PREUVES SONT DES FAITS. Les lieux sont posés sur un vrai disque, avec les vrais
// en-têtes ; les agents ÉCRIVENT un fichier quand ils reçoivent ; et « il n'a rien reçu » se
// prouve par l'ABSENCE de ce fichier, jamais par un message qui l'annoncerait.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';

let Veilleur, sauverRegistre, chargerRegistre, ligneDuPane, canauxCommuns, communPourCanal, estCanalCommun;
let racine;
let compteur = 0;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-role-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre, ligneDuPane, canauxCommuns, communPourCanal, estCanalCommun } = await import(
    '../src/registre.js'
  ));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [], communs: {}, commun: null }));

const CANAL_ORCH = { id: 'C_ORCH', name: 'annonces-orchestrateurs', is_private: false, membres: ['UMOI', 'UDIR'] };
const CANAL_REPR = { id: 'C_REPR', name: 'annonces-gestionnaires', is_private: false, membres: ['UMOI', 'UDIR'] };
const DIRIGEANT = 'UDIR';

async function avecSlack(etat, corps) {
  const monde = fauxSlack(etat).installer();
  try {
    return await corps(monde);
  } finally {
    monde.restaurer();
  }
}

// ————————————————————————————————————————————————— des LIEUX, posés sur un vrai disque

/**
 * Un lieu tel que la pose l'aurait laissé — les quatre fichiers, et les EN-TÊTES RÉELS.
 *
 * Reproduire ici les en-têtes en clair est délibéré : les importer de `roles.js` ferait dire
 * au test la même chose que le code, et un en-tête changé des deux côtés à la fois passerait
 * inaperçu. Ce sont les en-têtes que les gabarits du pack portent VRAIMENT — un test les garde
 * déjà par ailleurs, contre les fichiers eux-mêmes.
 */
function lieu(entetes, sous = `lieu-${(compteur += 1)}`) {
  const chemin = join(racine, sous);
  mkdirSync(join(chemin, '.claude'), { recursive: true });
  writeFileSync(join(chemin, 'CLAUDE.md'), `${entetes.claude}\n\nle reste du métier\n`);
  writeFileSync(join(chemin, 'CONTEXTE.md'), `${entetes.contexte}\n`);
  writeFileSync(join(chemin, '.mcp.json'), '{"mcpServers":{}}\n');
  writeFileSync(join(chemin, '.claude', 'settings.json'), '{"permissions":{"allow":[]}}\n');
  return chemin;
}

const METIER_ORCH = { claude: "# Tu es l'orchestrateur de ce chantier", contexte: '# Ce qui est propre à ce dépôt' };
const METIER_REPR = { claude: '# Tu es le représentant de ce client', contexte: "# Ce qu'on sait de ce client" };

/** Le lieu d'un chef d'équipe : un worktree ordinaire. Il n'y a rien à y poser — c'est le sujet. */
function worktreeOrdinaire() {
  const chemin = join(racine, `worktree-${(compteur += 1)}`);
  mkdirSync(chemin, { recursive: true });
  writeFileSync(join(chemin, 'CLAUDE.md'), '# somtech-pack\n');
  return chemin;
}

/**
 * Des agents qui TRAVAILLENT, chacun depuis un répertoire réel — et dont on lira ce qu'ils
 * ont FAIT de ce qu'ils ont reçu.
 *
 * `foreground_cwd` d'abord, `cwd` en repli : c'est ce que herdr rend (mesuré le 2026-08-14
 * contre `herdr agent list`), et c'est déjà la lecture que fait le réveil horaire.
 */
function agentsQuiTravaillent(liste) {
  const dossier = join(racine, `travail-${(compteur += 1)}`);
  mkdirSync(dossier, { recursive: true });
  return {
    dossier,
    fichier: (pane) => join(dossier, `${pane.replace(/[^a-z0-9]/gi, '_')}.txt`),
    recu(pane) {
      const f = this.fichier(pane);
      return existsSync(f) ? readFileSync(f, 'utf8') : null;
    },
    async vivant(pane) {
      return liste.some((a) => a.pane === pane);
    },
    async remettre(pane, texte) {
      const cible = this.fichier(pane);
      rmSync(cible, { force: true });
      writeFileSync(cible, texte);
      return { delivered: true };
    },
    async agents() {
      return liste.map((a) => ({
        agent: 'claude',
        pane_id: a.pane,
        name: a.nom ?? null,
        foreground_cwd: a.repertoire ?? null,
        cwd: a.cwd ?? null,
        herdr_socket: `/s/${a.pane}`,
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

/** Désigne les deux canaux, un par rôle — l'état nominal de ce lot. */
async function designerLesDeux(v) {
  const a = await v.designerCommun({ canal: 'annonces-orchestrateurs', role: 'orchestrateur', autorises: [DIRIGEANT] });
  const b = await v.designerCommun({ canal: 'annonces-gestionnaires', role: 'representant', autorises: [DIRIGEANT] });
  assert.equal(a.ok, true, `désignation orchestrateur refusée : ${a.erreur}`);
  assert.equal(b.ok, true, `désignation gestionnaire refusée : ${b.erreur}`);
}

// ═════════════════ 1. LE RÔLE EST ÉTABLI PAR LE FAIT, JAMAIS PAR CE QU'ON DIT ÊTRE

test('RÔLE — il se lit dans le lieu, pas dans le nom que l’agent porte', async () => {
  const { roleDuLieu } = await import('../src/lieu-agent.js');

  assert.equal(roleDuLieu(lieu(METIER_ORCH)), 'orchestrateur');
  assert.equal(roleDuLieu(lieu(METIER_REPR)), 'representant');

  // Un worktree ordinaire — le lieu d'un chef d'équipe — n'est le lieu de personne.
  assert.equal(roleDuLieu(worktreeOrdinaire()), null);

  // ET C'EST LE POINT : un nom d'agent est une chaîne que n'importe qui écrit. Un lieu
  // ordinaire NOMMÉ « orchestrateur » reste un lieu ordinaire.
  const menteur = worktreeOrdinaire();
  mkdirSync(join(menteur, '.orchestrateur', 'faux'), { recursive: true });
  assert.equal(roleDuLieu(menteur), null, 'un dossier au bon nom ne fait pas un lieu');

  // Un lieu à demi posé non plus : le métier y est, les moyens n'y sont pas.
  const demi = lieu(METIER_ORCH);
  rmSync(join(demi, '.claude', 'settings.json'));
  assert.equal(roleDuLieu(demi), null, 'un lieu incomplet n’établit aucun rôle');
});

// ═════════════════ 2. CHACUN NE REÇOIT QUE LE SIEN — par le fait

test('DIFFUSER — l’orchestrateur et le gestionnaire reçoivent chacun SA consigne, et rien de l’autre', async () => {
  const travail = agentsQuiTravaillent([
    { pane: 'w1:orch', repertoire: lieu(METIER_ORCH) },
    { pane: 'w2:gest', repertoire: lieu(METIER_REPR) },
  ]);

  await avecSlack({ canaux: [CANAL_ORCH, CANAL_REPR] }, async (monde) => {
    const v = veilleur({ herdr: travail });
    await designerLesDeux(v);

    await v.remettreAuChantier({ channel: 'C_ORCH', user: DIRIGEANT, text: 'Un nouveau MCP est disponible sur le SD.' });

    assert.match(travail.recu('w1:orch') ?? '', /nouveau MCP/, 'l’orchestrateur devait recevoir la sienne');
    assert.equal(travail.recu('w2:gest'), null, 'le gestionnaire ne doit RIEN recevoir de ce canal');

    await v.remettreAuChantier({
      channel: 'C_REPR',
      user: DIRIGEANT,
      text: 'Une règle de conduite face au client a changé.',
    });

    assert.match(travail.recu('w2:gest') ?? '', /règle de conduite/, 'le gestionnaire devait recevoir la sienne');
    // Et l'orchestrateur en est resté à la sienne — l'absence se prouve ici par le CONTENU,
    // son fichier existant déjà.
    assert.match(travail.recu('w1:orch'), /nouveau MCP/, 'l’orchestrateur ne doit pas avoir reçu celle du gestionnaire');
    assert.ok(!travail.recu('w1:orch').includes('règle de conduite'));

    assert.deepEqual(monde.postes, [], 'aucune diffusion ne poste dans Slack');
  });
});

test('DIFFUSER — le chef d’équipe ne reçoit RIEN, d’aucun des deux canaux', async () => {
  // LA PREUVE EST L'ABSENCE dans son pane. Pas un message qui l'annonce, pas un journal : le
  // fichier qu'il écrit en recevant n'existe pas.
  const travail = agentsQuiTravaillent([
    { pane: 'w1:orch', repertoire: lieu(METIER_ORCH) },
    { pane: 'w9:chef', repertoire: worktreeOrdinaire(), nom: 't-20260814-0002' },
  ]);

  await avecSlack({ canaux: [CANAL_ORCH, CANAL_REPR] }, async () => {
    const v = veilleur({ herdr: travail });
    await designerLesDeux(v);

    await v.remettreAuChantier({ channel: 'C_ORCH', user: DIRIGEANT, text: 'consigne aux orchestrateurs' });
    await v.remettreAuChantier({ channel: 'C_REPR', user: DIRIGEANT, text: 'consigne aux gestionnaires' });

    assert.ok(travail.recu('w1:orch'), 'l’orchestrateur, lui, a bien reçu — sinon ce test ne prouve rien');
    assert.equal(travail.recu('w9:chef'), null, 'le chef d’équipe ne reçoit rien du canal commun');
  });
});

test('DIFFUSER — un rôle qui ne s’établit pas ne reçoit rien : le défaut est le SILENCE', async () => {
  const demiPose = lieu(METIER_ORCH);
  rmSync(join(demiPose, '.claude', 'settings.json')); // une pose interrompue

  const travail = agentsQuiTravaillent([
    { pane: 'w1:orch', repertoire: lieu(METIER_ORCH) },
    { pane: 'w2:demi', repertoire: demiPose },
    { pane: 'w3:nulle-part', repertoire: null, cwd: null }, // herdr ne rend aucun répertoire
    { pane: 'w4:disparu', repertoire: join(racine, 'ce-repertoire-n-existe-pas') },
  ]);

  await avecSlack({ canaux: [CANAL_ORCH, CANAL_REPR] }, async () => {
    const v = veilleur({ herdr: travail });
    await designerLesDeux(v);
    const bilan = await v.diffuserConsigne({ channel: 'C_ORCH', user: DIRIGEANT, text: 'consigne' });

    assert.equal(bilan.remis, 1, 'un seul agent a un rôle établi');
    for (const muet of ['w2:demi', 'w3:nulle-part', 'w4:disparu']) {
      assert.equal(travail.recu(muet), null, `${muet} n’a pas de rôle établi : il ne reçoit rien`);
    }
  });
});

test('DIFFUSER — un lieu du BON rôle reçoit même si l’agent n’a aucune ligne', async () => {
  // Le lot précédent avait tranché « un agent sans ligne entend quand même ». Ce lot restreint
  // par le RÔLE, pas par la ligne : un orchestrateur qui n'a pas encore ouvert la sienne reste
  // un orchestrateur, et rien au registre ne le dit — c'est bien le lieu qui l'établit.
  const travail = agentsQuiTravaillent([{ pane: 'w1:orch', repertoire: lieu(METIER_ORCH) }]);

  await avecSlack({ canaux: [CANAL_ORCH, CANAL_REPR] }, async () => {
    const v = veilleur({ herdr: travail });
    await designerLesDeux(v);
    assert.deepEqual(chargerRegistre().lignes, [], 'aucune ligne au registre');

    await v.remettreAuChantier({ channel: 'C_ORCH', user: DIRIGEANT, text: 'mettez à jour vos configurations' });
    assert.match(travail.recu('w1:orch') ?? '', /mettez à jour/);
  });
});

test('DIFFUSER — aucun agent du rôle visé au travail : rien n’est remis, et rien n’est dit dans le canal', async () => {
  const travail = agentsQuiTravaillent([{ pane: 'w2:gest', repertoire: lieu(METIER_REPR) }]);

  await avecSlack({ canaux: [CANAL_ORCH, CANAL_REPR] }, async (monde) => {
    const v = veilleur({ herdr: travail });
    await designerLesDeux(v);
    const bilan = await v.diffuserConsigne({ channel: 'C_ORCH', user: DIRIGEANT, text: 'consigne aux orchestrateurs' });

    assert.equal(bilan, undefined, 'aucun destinataire : la diffusion se termine sans remise');
    assert.equal(travail.recu('w2:gest'), null, 'et surtout : le gestionnaire ne sert PAS de repli');
    assert.deepEqual(monde.postes, [], 'un silence ne se raconte pas dans le canal');
  });
});

// ═════════════════ 3. LA DÉSIGNATION — un rôle, jamais deviné

test('DÉSIGNER — sans rôle, rien n’est désigné : deviner viserait le mauvais public', async () => {
  await avecSlack({ canaux: [CANAL_ORCH] }, async () => {
    const v = veilleur();

    const sansRole = await v.designerCommun({ canal: 'annonces-orchestrateurs', autorises: [DIRIGEANT] });
    assert.equal(sansRole.ok, false, 'un canal commun sans rôle ne se désigne pas');
    assert.equal(sansRole.motif, 'role_absent');

    const inconnu = await v.designerCommun({
      canal: 'annonces-orchestrateurs',
      role: 'chef-equipe',
      autorises: [DIRIGEANT],
    });
    assert.equal(inconnu.ok, false, 'un rôle inconnu ne se rabat pas sur un défaut');
    assert.equal(inconnu.motif, 'role_inconnu');

    assert.deepEqual(canauxCommuns(chargerRegistre()), [], 'et aucun refus n’inscrit quoi que ce soit');
  });
});

test('DÉSIGNER — un canal ne peut pas servir DEUX rôles : ce serait le canal unique qu’on supprime', async () => {
  await avecSlack({ canaux: [CANAL_ORCH] }, async () => {
    const v = veilleur();
    assert.equal(
      (await v.designerCommun({ canal: 'annonces-orchestrateurs', role: 'orchestrateur', autorises: [DIRIGEANT] })).ok,
      true
    );

    const double = await v.designerCommun({
      canal: 'annonces-orchestrateurs',
      role: 'representant',
      autorises: [DIRIGEANT],
    });
    assert.equal(double.ok, false, 'le même canal pour deux rôles est refusé');
    assert.equal(double.motif, 'deja_dun_autre_role');

    const inscrits = canauxCommuns(chargerRegistre());
    assert.equal(inscrits.length, 1, 'et le refus n’a rien ajouté');
    assert.equal(inscrits[0].role, 'orchestrateur');
  });
});

test('DÉSIGNER — redésigner LE MÊME rôle sur le même canal met la liste des autorisés à jour', async () => {
  await avecSlack({ canaux: [CANAL_ORCH] }, async () => {
    const v = veilleur();
    await v.designerCommun({ canal: 'annonces-orchestrateurs', role: 'orchestrateur', autorises: [DIRIGEANT] });
    const r = await v.designerCommun({
      canal: 'annonces-orchestrateurs',
      role: 'orchestrateur',
      autorises: [DIRIGEANT, 'UAUTRE'],
    });
    assert.equal(r.ok, true, 'corriger la liste d’un rôle déjà désigné n’est pas un conflit avec lui-même');
    assert.deepEqual(chargerRegistre().communs.orchestrateur.autorises, [DIRIGEANT, 'UAUTRE']);
  });
});

test('DÉSIGNER — les trois refus du lot précédent tiennent, sur CHAQUE rôle', async () => {
  // Rejoués à la forme à plusieurs canaux : ce sont les gardes payées cher hier, et un
  // deuxième chemin de désignation est exactement l'endroit où une porte sur deux réapparaît.
  for (const role of ['orchestrateur', 'representant']) {
    await avecSlack({ canaux: [] }, async () => {
      const v = veilleur();
      const absent = await v.designerCommun({ canal: 'annonces-orchestrateurs', role, autorises: [DIRIGEANT] });
      assert.equal(absent.motif, 'absent', `${role} : un canal inexistant ne se désigne pas`);
    });

    await avecSlack({ canaux: [{ ...CANAL_ORCH, membres: [DIRIGEANT] }] }, async () => {
      const v = veilleur();
      const dehors = await v.designerCommun({ canal: 'annonces-orchestrateurs', role, autorises: [DIRIGEANT] });
      assert.equal(dehors.motif, 'non_membre', `${role} : un robot ne se met pas lui-même dans un canal`);
    });

    await avecSlack({ canaux: [{ ...CANAL_ORCH, is_archived: true }] }, async () => {
      const v = veilleur();
      const archive = await v.designerCommun({ canal: 'annonces-orchestrateurs', role, autorises: [DIRIGEANT] });
      assert.equal(archive.motif, 'archive', `${role} : un canal archivé a l’air posé et rien n’en part`);
    });

    await avecSlack({ canaux: [CANAL_ORCH] }, async () => {
      const v = veilleur();
      const sansListe = await v.designerCommun({ canal: 'annonces-orchestrateurs', role, autorises: [] });
      assert.equal(sansListe.ok, false, `${role} : sans autorisé, tout l’espace parlerait à tous`);
    });

    assert.deepEqual(canauxCommuns(chargerRegistre()), [], `${role} : aucun de ces refus n’inscrit rien`);
  }
});

test('DÉSIGNER — un canal qui porte déjà une ligne est refusé, quel que soit le rôle visé', async () => {
  sauverRegistre({
    version: 1,
    communs: {},
    commun: null,
    lignes: [
      ligne({ chantier: 'acme', canalId: 'C_REPR', canalNom: 'annonces-gestionnaires', pane: 'w1:p1', nature: 'client' }),
    ],
  });
  await avecSlack({ canaux: [CANAL_REPR] }, async () => {
    const v = veilleur();
    const r = await v.designerCommun({ canal: 'annonces-gestionnaires', role: 'representant', autorises: [DIRIGEANT] });
    assert.equal(r.ok, false, 'le client parlerait à tous les gestionnaires du poste');
    assert.deepEqual(canauxCommuns(chargerRegistre()), []);
  });
});

// ═════════════════ 4. RIEN NE REPART — la garde rejouée sur PLUSIEURS canaux

test('DESCENDANT — « dire », « fermer », « renommer » sont refusés sur CHACUN des canaux, par les DEUX clés', async () => {
  // Le défaut trouvé hier par mutation : la garde ne couvrait que l'argument `canal_id`, et le
  // chemin par CHANTIER passait à côté — `fermer` aurait posté son bilan dans le canal de tous
  // puis l'aurait archivé. On rejoue les deux clés, sur les deux canaux, avec une ligne héritée
  // sur chacun : c'est l'état où le refus compte vraiment, et le registre survit aux versions.
  sauverRegistre({
    version: 1,
    communs: {
      orchestrateur: { canal_id: 'C_ORCH', canal_nom: 'annonces-orchestrateurs', autorises: [DIRIGEANT], designe_le: 'hier' },
      representant: { canal_id: 'C_REPR', canal_nom: 'annonces-gestionnaires', autorises: [DIRIGEANT], designe_le: 'hier' },
    },
    commun: null,
    lignes: [
      ligne({ chantier: 'D-7', canalId: 'C_ORCH', canalNom: 'annonces-orchestrateurs', pane: 'w1:p1', worktree: '/w/o' }),
      ligne({ chantier: 'D-8', canalId: 'C_REPR', canalNom: 'annonces-gestionnaires', pane: 'w1:p1', worktree: '/w/g' }),
    ],
  });

  await avecSlack({ canaux: [CANAL_ORCH, CANAL_REPR] }, async (monde) => {
    const v = veilleur({ herdr: agentsQuiTravaillent([]) });

    for (const [canalId, chantier, worktree, nom] of [
      ['C_ORCH', 'D-7', '/w/o', 'annonces-orchestrateurs'],
      ['C_REPR', 'D-8', '/w/g', 'annonces-gestionnaires'],
    ]) {
      assert.equal((await v.dire({ canal_id: canalId, texte: 'parole d’agent' })).ok, false, `${nom} : dire par canal`);
      assert.equal(
        (await v.dire({ chantier, worktree, texte: 'rapport de chantier' })).ok,
        false,
        `${nom} : dire par CHANTIER`
      );
      assert.equal((await v.fermer({ canal_id: canalId, bilan: 'bilan' })).ok, false, `${nom} : fermer par canal`);
      assert.equal(
        (await v.fermer({ chantier, worktree, bilan: 'bilan' })).ok,
        false,
        `${nom} : fermer par CHANTIER`
      );
      assert.equal((await v.renommer({ canal_id: canalId, titre: 'autre' })).ok, false, `${nom} : renommer par canal`);
      assert.equal(
        (await v.renommer({ chantier, worktree, titre: 'autre' })).ok,
        false,
        `${nom} : renommer par CHANTIER`
      );

      assert.equal(monde.canalNomme(nom).is_archived, false, `${nom} ne s’archive pas`);
      assert.equal(monde.canalNomme(nom).name, nom, `${nom} ne se renomme pas`);
    }

    assert.deepEqual(monde.postes, [], 'aucune parole d’agent n’atteint un canal commun');
  });
});

test('DESCENDANT — aucune ligne ne s’ouvre sur l’un ou l’autre canal, même par collision de nom', async () => {
  await avecSlack({ canaux: [CANAL_ORCH, CANAL_REPR] }, async (monde) => {
    const v = veilleur({ herdr: agentsQuiTravaillent([]) });
    await designerLesDeux(v);

    for (const titre of ['Annonces orchestrateurs', 'Annonces gestionnaires']) {
      const r = await v.ouvrir({ chantier: 'D-9', titre, pane: 'w1:p1', worktree: '/w', invites: [DIRIGEANT] });
      assert.equal(r.ok, false, `l’ouverture sur « ${titre} » aurait dû être refusée : ${JSON.stringify(r)}`);
    }
    assert.deepEqual(chargerRegistre().lignes, [], 'et rien n’est inscrit');
    assert.deepEqual(monde.postes, []);
  });
});

// ═════════════════ 5. LA LIGNE PROPRE RESTE INTACTE — la garde la plus importante

test('LIGNE PROPRE — après sa consigne, la ligne du gestionnaire est toujours la sienne', async () => {
  // La preuve passe par `ligneDuPane`, LA FONCTION QUE LA COMMANDE APPELLE — jamais par un
  // filtre réécrit ici, qui ne prouverait que son propre accord avec lui-même.
  const lieuGest = lieu(METIER_REPR);
  sauverRegistre({
    version: 1,
    communs: {},
    commun: null,
    lignes: [ligne({ chantier: 'acme', canalId: 'C_acme', canalNom: 'acme', pane: 'w2:gest', nature: 'client', libelle: 'Acme' })],
  });

  const canalClient = { id: 'C_acme', name: 'acme', is_private: true, membres: ['UMOI', 'UCLIENT'] };
  await avecSlack({ canaux: [CANAL_ORCH, CANAL_REPR, canalClient] }, async (monde) => {
    const travail = agentsQuiTravaillent([{ pane: 'w2:gest', repertoire: lieuGest }]);
    const v = veilleur({ herdr: travail });
    await designerLesDeux(v);

    await v.remettreAuChantier({ channel: 'C_REPR', user: DIRIGEANT, text: 'une règle de conduite a changé' });
    assert.match(travail.recu('w2:gest') ?? '', /CANAL COMMUN/, 'il a bien reçu la consigne de son rôle');

    const etat = v.etat();
    assert.equal(etat.ouvertes.length, 1, '`ouvertes` ne porte que des LIGNES');
    assert.equal(etat.communs.length, 2, 'les canaux communs sont rendus À CÔTÉ');

    const { ligne: mienne, candidates } = ligneDuPane(etat.ouvertes, 'w2:gest');
    assert.equal(candidates.length, 1, 'aucun canal commun n’est candidat à la sélection par pane');
    assert.equal(mienne.chantier, 'acme');

    await v.dire({ chantier: mienne.chantier, worktree: mienne.worktree, texte: 'Bonjour, c’est noté.' });
    assert.deepEqual(
      monde.postes.map((p) => p.channel),
      ['C_acme'],
      'sa réponse va chez SON client, pas dans un canal commun'
    );

    // Et un message du client arrive toujours cadré de SA ligne, après la consigne commune.
    await v.remettreAuChantier({ channel: 'C_acme', user: 'UCLIENT', text: 'Bonjour, une question.' });
    assert.match(travail.recu('w2:gest'), /^\[LIGNE DIRECTE — acme \(#acme\)\] Message de /);
  });
});

// ═════════════════ 6. LE CADRE — il doit dire POUR QUEL RÔLE la consigne vaut

test('CADRE — un gestionnaire ne peut pas croire qu’une consigne d’orchestrateur le vise', async () => {
  const { cadrerConsigneCommune, cadrerPourAgent, COMMANDE } = await import('../src/cadre.js');

  const pourOrch = cadrerConsigneCommune({ texte: 'un nouveau MCP', canal: 'annonces-orchestrateurs', role: 'orchestrateur' });
  const pourGest = cadrerConsigneCommune({ texte: 'une règle change', canal: 'annonces-gestionnaires', role: 'representant' });

  // Chacun nomme SON rôle, et ne nomme pas l'autre — c'est ce qui coupe la confusion.
  assert.match(pourOrch, /ORCHESTRATEURS/);
  assert.match(pourGest, /REPRÉSENTANTS/);
  assert.ok(!pourOrch.includes('REPRÉSENTANTS'), 'le cadre d’un rôle ne mentionne pas l’autre');
  assert.ok(!pourGest.includes('ORCHESTRATEURS'));

  // Et il dit le FAIT qui manquerait autrement : les autres agents ne l'ont pas reçue.
  for (const cadre of [pourOrch, pourGest]) {
    assert.match(cadre, /Consigne du dirigeant/, 'il dit d’où ça vient');
    assert.match(cadre, /ON N'Y RÉPOND PAS/, 'et qu’on n’y répond pas');
    assert.match(cadre, /n['’]ont pas reçu/, 'et que les autres agents ne l’ont pas reçue');
    assert.ok(!cadre.includes('Réponds-lui'), 'aucune invitation à répondre');
    assert.ok(!cadre.includes(`${COMMANDE} dire`), 'aucune commande d’écriture');
    assert.ok(!cadre.startsWith('[LIGNE DIRECTE'), 'ni la signature visuelle d’un interlocuteur');
  }

  // Assertion croisée : ce qui invite à répondre existe bien, sur une ligne.
  assert.match(cadrerPourAgent({ chantier: 'acme', texte: 'bonjour', canal: 'acme' }), /Réponds-lui avec/);
});

test('CADRE — le rôle annoncé est celui du CANAL, pas celui du pane qui reçoit', async () => {
  // Un seul cadre est composé par diffusion. Le composer d'après le rôle d'un destinataire
  // ferait porter au message d'un autre l'étiquette du premier servi.
  const travail = agentsQuiTravaillent([
    { pane: 'w1:orch', repertoire: lieu(METIER_ORCH) },
    { pane: 'w2:orchbis', repertoire: lieu(METIER_ORCH) },
  ]);
  await avecSlack({ canaux: [CANAL_ORCH, CANAL_REPR] }, async () => {
    const v = veilleur({ herdr: travail });
    await designerLesDeux(v);
    await v.remettreAuChantier({ channel: 'C_ORCH', user: DIRIGEANT, text: 'consigne' });
    for (const pane of ['w1:orch', 'w2:orchbis']) {
      assert.match(travail.recu(pane) ?? '', /À TOUS LES ORCHESTRATEURS \(#annonces-orchestrateurs\)/, pane);
    }
  });
});

// ═════════════════ 7. LE CANAL D'AVANT — protégé, plus jamais diffusé, et dit

test('HÉRITÉ — un canal désigné SANS rôle ne diffuse plus rien, mais reste protégé', async () => {
  // v1.42.0 a désigné UN canal, sans rôle. Ce registre survit à la mise à jour. Le diffuser à
  // tout le monde rejouerait ce que ce lot corrige ; cesser de le protéger rouvrirait la porte
  // par laquelle `fermer` postait son bilan à tous puis archivait le canal. On fait donc les
  // deux : silence à la diffusion, garde maintenue, et l'état le DIT (sinon c'est un silence
  // de plus, exactement ce que le dispositif existe pour supprimer).
  sauverRegistre({
    version: 1,
    communs: {},
    commun: { canal_id: 'C_ORCH', canal_nom: 'annonces-orchestrateurs', autorises: [DIRIGEANT], designe_le: 'avant-hier' },
    lignes: [],
  });

  const travail = agentsQuiTravaillent([{ pane: 'w1:orch', repertoire: lieu(METIER_ORCH) }]);
  await avecSlack({ canaux: [CANAL_ORCH] }, async (monde) => {
    const v = veilleur({ herdr: travail });

    const bilan = await v.diffuserConsigne({ channel: 'C_ORCH', user: DIRIGEANT, text: 'mettez à jour' });
    assert.equal(bilan, undefined, 'un canal sans rôle ne diffuse plus');
    assert.equal(travail.recu('w1:orch'), null, 'et personne ne reçoit — pas même le rôle qu’on aurait supposé');

    // La garde, elle, tient toujours.
    assert.equal(estCanalCommun(chargerRegistre(), 'C_ORCH'), true);
    assert.equal((await v.fermer({ canal_id: 'C_ORCH', bilan: 'bilan' })).ok, false);
    assert.equal(monde.canalNomme('annonces-orchestrateurs').is_archived, false);
    assert.deepEqual(monde.postes, []);

    // Et l'opérateur le voit, plutôt que de chercher pourquoi rien ne part.
    assert.equal(v.etat().sans_role?.canal, 'annonces-orchestrateurs');
  });
});

test('HÉRITÉ — le désigner pour un rôle le reprend, et il cesse d’être orphelin', async () => {
  sauverRegistre({
    version: 1,
    communs: {},
    commun: { canal_id: 'C_ORCH', canal_nom: 'annonces-orchestrateurs', autorises: [DIRIGEANT], designe_le: 'avant-hier' },
    lignes: [],
  });
  const travail = agentsQuiTravaillent([{ pane: 'w1:orch', repertoire: lieu(METIER_ORCH) }]);

  await avecSlack({ canaux: [CANAL_ORCH] }, async () => {
    const v = veilleur({ herdr: travail });
    const r = await v.designerCommun({ canal: 'annonces-orchestrateurs', role: 'orchestrateur', autorises: [DIRIGEANT] });
    assert.equal(r.ok, true, 'reprendre le canal d’avant pour un rôle doit être possible');
    assert.equal(chargerRegistre().commun, null, 'et il n’est plus orphelin');
    assert.equal(v.etat().sans_role, null);

    await v.remettreAuChantier({ channel: 'C_ORCH', user: DIRIGEANT, text: 'mettez à jour' });
    assert.match(travail.recu('w1:orch') ?? '', /mettez à jour/, 'il diffuse de nouveau, à son rôle');
  });
});

// ═════════════════ 8. LA COMMANDE — le rôle ne se fait pas prendre pour le canal

test('COMMANDE — « --role » est une option À VALEUR : elle ne devient jamais le nom du canal', async () => {
  // Le défaut d'origine de `premierLibre`, mot pour mot : une option non déclarée fait prendre
  // sa VALEUR pour l'argument principal. Ici, cela désignerait un canal nommé « orchestrateur ».
  const { premierLibre, option, OPTIONS_A_VALEUR } = await import('../src/arguments.js');
  const args = ['--role', 'orchestrateur', 'annonces-orchestrateurs', '--dirigeant', 'maxime@somtech.ca'];

  assert.ok(OPTIONS_A_VALEUR.has('--role'), '`--role` doit être déclarée comme consommant sa valeur');
  assert.equal(premierLibre(args), 'annonces-orchestrateurs', 'le canal reste le canal');
  assert.equal(option(args, '--role'), 'orchestrateur');
});

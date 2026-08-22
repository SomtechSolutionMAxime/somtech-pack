// LE REGISTRE DES ORCHESTRATEURS — ET IL DIT CE QU'IL N'A PAS PU MESURER (E-20260819-0005).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE BANC GARDE
//
// « On ne peut pas répondre à *qui est vivant et est-il à jour* sans une passe manuelle. »
// Faite une fois le 2026-08-19, elle a trouvé trente-huit lieux dont AUCUN à jour — puis elle a
// périmé le lendemain. Le veilleur fait déjà la ronde ; il lui manquait de savoir quel métier
// chacun porte.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE QUE CE BANC ÉPROUVE EN PREMIER, ET POURQUOI IL COMMENCE PAR LÀ
//
// **Une panne d'inventaire n'est pas « aucun agent ».** Un registre qui traduit « je n'ai pas su
// regarder » en liste vide rend un tableau parfaitement vert sur un poste où plus rien n'est
// mesuré — et personne ne va chercher un défaut derrière un rapport qui dit « rien à signaler ».
//
// ⚠️ ET LA GARDE ROUGIT SUR UNE SOURCE **RÉELLEMENT** EN PANNE, jamais sur une liste vide
// fabriquée. Une fonction d'essai qui jette prouverait seulement que `unRecensement` sait
// attraper ce que l'essai lui lance ; elle ne prouverait rien de `herdr.panes()`, qui est le
// seul chemin que le veilleur emprunte. Ce banc fait donc échouer le VRAI transport : il vide le
// `PATH`, l'outil `herdr` devient introuvable, et c'est le vrai module qui refuse.
//
// *Ce dépôt a déjà payé l'autre voie : « un double plus cohérent que le service » a gardé 570
// essais verts sur une garde qui refusait tout le monde.*

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { panes as panesDeHerdr } from '../src/herdr.js';
import {
  unRecensement,
  referenceDuMetier,
  empreinteDuMetier,
  mandatDuChemin,
  lieuDuChemin,
  lieuDeRoleDansLeChemin,
  travailEnVol,
  GESTE_DE_REMISE_A_JOUR,
  CE_QUE_LE_RECENSEMENT_NE_VOIT_PAS,
} from '../src/recensement.js';
import { roleDuLieu } from '../src/lieu-agent.js';
import { etatDuMandat, familleDuMandat, STATUTS_CLOS, STATUTS_CONNUS } from '../src/mandat.js';
import { posteHerdr } from './aide/faux-herdr.js';

const racine = () => mkdtempSync(join(tmpdir(), 'recensement-'));

/**
 * UN LIEU D'ORCHESTRATEUR POSÉ POUR DE VRAI — les quatre fichiers et les VRAIS en-têtes.
 *
 * ⚠️ Ce n'est pas du décor : `roleDuLieu` établit le rôle par le FAIT, et il refusera tout ce
 * qui n'a pas les quatre fichiers ET les en-têtes du métier. Un lieu de banc qui n'en poserait
 * que le nom ferait rendre « aucun orchestrateur » à un module parfaitement correct — et on
 * corrigerait le module.
 */
function poserLieu(depot, mandat, metier) {
  const lieu = join(depot, '.orchestrateur', mandat);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), metier);
  writeFileSync(join(lieu, 'CONTEXTE.md'), "# Ce qui est propre à ce dépôt\n\nrien.\n");
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

const METIER_COURANT = "# Tu es l'orchestrateur de ce chantier\n\nle métier du jour.\n";
const METIER_PERIME = "# Tu es l'orchestrateur de ce chantier\n\nle métier d'avant.\n";

/**
 * Un « poste » de référence : le gabarit du pack, là où `referenceDuPoste` va le chercher.
 * `foyer` est injecté — la résolution réelle reste celle qui est exercée en production.
 */
function poserReference(racineTmp, metier) {
  const dir = join(
    racineTmp, 'foyer', '.claude', 'plugins', 'marketplaces', 'somtech-pack',
    '.claude', 'templates', 'orchestrateur'
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'CLAUDE.md'), metier);
  return join(racineTmp, 'foyer');
}

test('une source d’inventaire RÉELLEMENT en panne se dit — et rien dans le rendu ne se lit « rien à signaler »', async () => {
  const pathAvant = process.env.PATH;
  let rendu;
  try {
    // ⚠️ LA PANNE EST VRAIE : sans `PATH`, `herdr` est introuvable et `lancer` rend
    // `OutilIntrouvable`, que `panes()` laisse traverser. Aucun double n'intervient ici.
    process.env.PATH = '';
    // On vérifie D'ABORD que la source refuse pour de bon — sans quoi tout ce qui suit
    // éprouverait un chemin nominal en croyant éprouver une panne.
    await assert.rejects(() => panesDeHerdr(), /herdr/i, 'la source devait REFUSER, pas rendre une liste');
    rendu = await unRecensement({ panes: () => panesDeHerdr(), roleDuLieu });
  } finally {
    process.env.PATH = pathAvant;
  }

  assert.ok(rendu.inventaireRefuse, 'le refus doit être NOMMÉ dans le rendu');
  // ⚠️ LE CŒUR DU BANC : `null`, PAS `[]`. Une liste vide se lit « il n'y en a aucun ».
  assert.equal(rendu.agents, null, 'un inventaire refusé ne rend JAMAIS une liste vide');
  assert.equal(rendu.panesVus, null, 'on n’a vu aucun pane, on n’en a pas COMPTÉ zéro');
  // Et le lecteur qui ne lit que la phrase doit comprendre qu'on n'a pas su regarder.
  assert.match(rendu.resume, /n’ai pas (pu|su)/, 'le résumé doit dire l’impuissance, pas le vide');
  assert.doesNotMatch(rendu.resume, /rien à signaler|aucun orchestrateur vivant/i);
});

test('un poste sans aucun AGENT rend zéro SANS refus — et les deux cas se distinguent', async () => {
  // ⚠️ DEPUIS E-20260822-0001, UN PANE HORS DE TOUT LIEU DE RÔLE N'EST PLUS OMIS : il figure au
  // registre avec un rôle « non établi ». La liste vide, elle, garde exactement le rôle qu'elle
  // avait — dire « j'ai regardé et il n'y a personne », par opposition à « je n'ai pas su
  // regarder ». Ce banc l'éprouve donc sur un poste RÉELLEMENT sans pane.
  const rendu = await unRecensement({ panes: [], roleDuLieu });
  assert.equal(rendu.inventaireRefuse, null);
  assert.deepEqual(rendu.agents, [], 'ici la liste vide est la VRAIE réponse');
  assert.equal(rendu.panesVus, 0, 'on a bien regardé, et on l’a compté');

  // Et le pane hors lieu, lui, est VU — la distinction « rien » / « je ne sais pas » se joue
  // maintenant sur le rôle de l'entrée, pas sur son absence du tableau.
  const horsLieu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: '/tmp/quelconque' }],
    roleDuLieu,
  });
  assert.equal(horsLieu.agents.length, 1, 'il n’est plus effacé du registre');
  assert.equal(horsLieu.agents[0].role.mesure, 'non établi');
});

test('le registre rend chaque orchestrateur avec l’empreinte de son métier et son écart, par le TRANSPORT réel', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));

  const foyer = poserReference(tmp, METIER_COURANT);
  const reference = referenceDuMetier({ foyer });
  assert.ok(reference.empreinte, 'la référence doit être mesurable, sinon ce banc n’éprouve rien');

  const depot = join(tmp, 'depot');
  poserLieu(depot, 'd-20260819-0001', METIER_COURANT);
  poserLieu(depot, 'j-20260814-0002', METIER_PERIME);
  // Un dossier au bon NOM mais sans métier : il ne doit pas entrer au registre.
  mkdirSync(join(depot, '.orchestrateur', 'coquille'), { recursive: true });

  const poste = posteHerdr(tmp, []);
  poste.panes([
    // ⚠️ LE NOM N'A AUCUN RAPPORT AVEC LE MANDAT, ET C'EST EXPRÈS. Depuis la `v1.72.0` un agent
    // porte un nom de rivière ; une passe d'inventaire qui cherchait les agents par leur nom en
    // a manqué un le 2026-08-19 alors qu'il était sous ses yeux. Ce banc rougirait si le module
    // se remettait à inventorier par le nom.
    { pane_id: 'w1:p1', name: 'ristigouche', foreground_cwd: join(depot, '.orchestrateur', 'd-20260819-0001') },
    { pane_id: 'w2:p3', name: 'matapedia', foreground_cwd: join(depot, '.orchestrateur', 'j-20260814-0002') },
    { pane_id: 'w2:p4', foreground_cwd: join(depot, '.orchestrateur', 'coquille') },
    { pane_id: 'w9:p9', foreground_cwd: join(tmp, 'un-depot-ordinaire') },
  ]);

  const pathAvant = process.env.PATH;
  let rendu;
  try {
    process.env.PATH = poste.path;
    // ⚠️ `FAUX_HERDR_ETAT` N'EST PAS DÉCORATIF : sans lui le faux binaire meurt avant de servir
    // quoi que ce soit, `panes()` refuse, et ce banc éprouverait la garde de panne en croyant
    // éprouver le chemin nominal — vert pour la mauvaise raison.
    process.env.FAUX_HERDR_ETAT = poste.etat;
    // Le socket est DÉSIGNÉ : sans lui, `panes()` agrégerait les sessions herdr du poste RÉEL
    // qui exécute ce banc, et le rendu dépendrait de ce que la machine porte ce jour-là.
    rendu = await unRecensement({
      panes: () => panesDeHerdr({ socket: join(poste.etat, 'socket') }),
      roleDuLieu,
      references: { orchestrateur: reference },
    });
  } finally {
    process.env.PATH = pathAvant;
    delete process.env.FAUX_HERDR_ETAT;
  }
  assert.ok(rendu.agents, `l’inventaire a refusé (${rendu.inventaireRefuse}) — ce banc n’éprouve alors rien`);

  // ⚠️ LA GARDE N'A PAS BOUGÉ, SON POINT D'APPUI SI. Avant E-20260822-0001, « la coquille
  // n'entre pas » s'éprouvait sur son ABSENCE du tableau. Depuis, elle y figure avec un rôle
  // « non établi » — parce que l'effacer était le vrai défaut : un agent bien vivant dans un
  // lieu à demi posé ne laissait aucune trace nulle part (T-20260819-0070). Ce qu'on garde est
  // donc ce que l'assertion voulait dire : elle ne devient pas un ORCHESTRATEUR.
  const orchestrateurs = rendu.agents.filter((o) => o.role.mesure === 'établi' && o.role.nom === 'orchestrateur');
  const mandats = orchestrateurs.map((o) => o.mandat).sort();
  assert.deepEqual(mandats, ['d-20260819-0001', 'j-20260814-0002'], 'ni la coquille ni le dépôt ordinaire ne portent le rôle');

  // Et ils sont bien LÀ, sans le rôle — sans quoi on aurait rétabli l'effacement en croyant
  // garder la coquille hors du compte.
  const sansRole = rendu.agents.filter((o) => o.role.mesure !== 'établi');
  assert.equal(sansRole.length, 2, 'la coquille et le dépôt ordinaire figurent, sans rôle établi');
  assert.ok(
    sansRole.every((o) => o.role.nom === null && o.aJour === null),
    'un rôle non établi ne se compare à aucune référence — ni « à jour », ni « en retard »'
  );

  const ajour = rendu.agents.find((o) => o.mandat === 'd-20260819-0001');
  assert.equal(ajour.aJour, true);
  assert.equal(ajour.ecartOctets, 0);
  assert.equal(ajour.remiseAJour, null, 'on ne propose rien à qui est déjà à jour');

  const enRetard = rendu.agents.find((o) => o.mandat === 'j-20260814-0002');
  assert.equal(enRetard.aJour, false);
  assert.equal(enRetard.ecartOctets, METIER_PERIME.length - METIER_COURANT.length);
  assert.equal(enRetard.metier.empreinte, empreinteDuMetier(join(depot, '.orchestrateur', 'j-20260814-0002')).empreinte);
  // ⚠️ LE GESTE EST RENDU, JAMAIS ENVOYÉ — et il ne vient jamais sans son prix.
  assert.equal(enRetard.remiseAJour.geste, GESTE_DE_REMISE_A_JOUR);
  assert.equal(enRetard.remiseAJour.aImposer, false);
  assert.match(enRetard.remiseAJour.prix, /pas maintenant/);

  // Aucun geste n'a été posé sur aucun pane : le registre LIT, il n'agit pas.
  const gestes = poste.appels().filter((a) => a[1] === 'prompt' || a[1] === 'send-keys');
  assert.deepEqual(gestes, [], 'le recensement ne doit RIEN envoyer à personne');
});

test('un métier illisible rend une mesure REFUSÉE — jamais un écart de zéro', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const foyer = poserReference(tmp, METIER_COURANT);
  const depot = join(tmp, 'depot');
  const lieu = poserLieu(depot, 'd-illisible', METIER_COURANT);
  // Les droits sont rendus AVANT le nettoyage, pas après : les crochets de fin s'exécutent dans
  // l'ordre où ils ont été posés, et celui qui efface le répertoire a été posé le premier.
  chmodSync(join(lieu, 'CLAUDE.md'), 0o000);

  const rendu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu: () => 'orchestrateur', // le lieu est bien posé ; c'est SA LECTURE qui échoue
    references: { orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }) },
  });
  const o = rendu.agents[0];
  assert.ok(o.metier.refus, 'la mesure refusée doit se dire');
  assert.equal(o.aJour, null, '« je ne sais pas » n’est ni « à jour » ni « en retard »');
  assert.equal(o.ecartOctets, null, 'un écart de zéro dirait « identique » — on n’en sait rien');
  assert.equal(rendu.compte.nonMesures, 1);
  assert.equal(rendu.compte.aJour, 0);
});

test('une référence introuvable ne fait jamais conclure « à jour »', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const lieu = poserLieu(depot, 'd-sans-reference', METIER_COURANT);

  const reference = referenceDuMetier({ foyer: join(tmp, 'foyer-vide') });
  assert.ok(reference.refus, 'la référence doit se déclarer introuvable');

  const rendu = await unRecensement({ panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }], roleDuLieu, reference });
  const o = rendu.agents[0];
  assert.ok(o.metier.empreinte, 'son métier, lui, a bien été mesuré');
  assert.equal(o.aJour, null);
  assert.equal(o.ecartOctets, null);
  assert.equal(o.remiseAJour, null, 'on ne propose pas un geste sur une comparaison qu’on n’a pas faite');
});

test('« au repos » n’est pas « sans travail en vol » — et un écran illisible se dit', () => {
  // ⚠️ LES DEUX ÉCRANS SONT CEUX DU RENDU RÉEL, relevés le 2026-08-19 sur un même agent avant
  // et après qu'il ait lancé du travail. C'est la contre-épreuve : la mention est ABSENTE puis
  // PRÉSENTE. Sans elle, ce banc éprouverait une expression régulière contre elle-même.
  const auRepos = '  ⏸ manual mode on · ? for shortcuts · ← for agents';
  const enVol = '  ⏸ manual mode on · 1 shell · /tasks to see subagents · ← for agents · ↓ to manage';

  assert.equal(travailEnVol(auRepos).enVol, false);
  assert.equal(travailEnVol(auRepos).shells, 0);

  const vu = travailEnVol(enVol);
  assert.equal(vu.enVol, true);
  assert.equal(vu.shells, 1);
  assert.equal(vu.sousAgents, true);
  assert.ok(vu.rendu, 'le rendu sur lequel ça a été mesuré voyage AVEC la mesure');

  // ⚠️ ET LE CŒUR DE LA RÈGLE : une lecture ratée se dit, elle ne se lit jamais « rien en vol ».
  const rate = travailEnVol(null);
  assert.equal(rate.mesure, 'refusée');
  assert.equal(rate.enVol, null, 'null n’est pas false — « je ne sais pas » n’est pas « rien »');
});

test('le mandat se lit dans le CHEMIN pour TOUS les rôles, quel que soit le nom porté', () => {
  // ⚠️ LE PLUS PROFOND GAGNE. Un lieu de représentant posé dans un dépôt qui porte lui-même un
  // `.orchestrateur/` existe réellement sur ce poste : prendre le PREMIER segment de rôle
  // rendrait un représentant pour un orchestrateur, avec un mandat qui n'est pas le sien.
  const imbrique = lieuDeRoleDansLeChemin('/d/.orchestrateur/p-1/.gestionnaire/Frederic');
  assert.equal(imbrique.role, 'representant', 'le lieu où il TRAVAILLE est le dernier, pas le premier');
  assert.equal(imbrique.mandat, 'Frederic');
  assert.equal(lieuDeRoleDansLeChemin('/d/quelconque'), null, 'aucun lieu de rôle : on ne devine pas');
  // Un dossier de rôle SANS lieu nommé dessous ne désigne personne — et ne doit pas passer.
  assert.equal(lieuDeRoleDansLeChemin('/d/.orchestrateur'), null);

  const c = '/Users/x/worktrees/depot/.orchestrateur/j-20260814-0002';
  assert.equal(mandatDuChemin(c, '.orchestrateur'), 'j-20260814-0002');
  assert.equal(lieuDuChemin(c, '.orchestrateur'), c);
  // Un sous-répertoire du lieu désigne toujours le lieu, pas le sous-répertoire.
  assert.equal(lieuDuChemin(`${c}/.claude`, '.orchestrateur'), c);
  assert.equal(mandatDuChemin('/Users/x/depot', '.orchestrateur'), null);
  assert.equal(mandatDuChemin('/Users/x/.orchestrateur', '.orchestrateur'), null, 'un dossier sans mandat n’en porte pas');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'ÉTAT DU MANDAT — parce qu'une session au repos et un chantier clos disent le même mot
//
// Le 2026-08-19, une mise à jour a été proposée à cinq orchestrateurs dont un avait son mandat
// clos depuis 08h35. La mesure disait `idle` ; la conclusion tirée était « actif ». Le risque
// nommé n'est pas le gaspillage : c'est **deux orchestrateurs sur les mêmes panes, chacun
// croyant l'autre parti** (T-20260819-0056).

test('un mandat CLOS ne se voit rien proposer — et la raison est écrite', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const foyer = poserReference(tmp, METIER_COURANT);
  const lieu = poserLieu(join(tmp, 'depot'), 'j-20260814-0002', METIER_PERIME);

  const rendu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', agent_status: 'idle', foreground_cwd: lieu }],
    roleDuLieu,
    references: { orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }) },
    etatDuMandat: (m) => etatDuMandat(m, { appeler: async () => ({ status: 'deployed' }) }),
  });
  const o = rendu.agents[0];
  assert.equal(o.statut, 'idle', 'la session, elle, est bien au repos');
  assert.equal(o.chantier.clos, true, 'et son chantier, lui, est fermé — ce n’est pas la même chose');
  assert.equal(o.aJour, false, 'il est bien en retard : ce n’est pas ça qui le protège');
  assert.equal(o.remiseAJour.aProposer, false, 'on ne réveille pas un mandat clos');
  assert.match(o.remiseAJour.pourquoiPas, /CLOS/);
  assert.match(o.remiseAJour.pourquoiPas, /m[êe]mes panes/);
  assert.equal(rendu.compte.mandatsClos, 1);
  assert.equal(rendu.compte.mandatsOuverts, 0);
});

test('un mandat prouvé OUVERT et en retard se voit proposer le geste — sinon le registre ne servirait à rien', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const foyer = poserReference(tmp, METIER_COURANT);
  const lieu = poserLieu(join(tmp, 'depot'), 'd-20260819-0001', METIER_PERIME);

  const rendu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu,
    references: { orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }) },
    etatDuMandat: (m) => etatDuMandat(m, { appeler: async () => ({ status: 'in_progress' }) }),
  });
  const o = rendu.agents[0];
  assert.equal(o.chantier.clos, false);
  assert.equal(o.remiseAJour.aProposer, true);
  assert.equal(o.remiseAJour.aImposer, false, 'proposer n’est jamais imposer');
  // ⚠️ LE PRIX VOYAGE AVEC LA PROPOSITION, jamais après. Une proposition sans son prix
  // demanderait un consentement à quelque chose que l'agent ne peut pas évaluer — et il ne
  // pourra plus l'évaluer APRÈS, puisque le geste lui aura effacé le fil.
  assert.match(o.remiseAJour.prix, /efface le fil/);
  assert.match(o.remiseAJour.prix, /pas maintenant/);
  assert.equal(rendu.compte.mandatsOuverts, 1);
});

test('un mandat NON MESURÉ ne se voit rien proposer non plus — « probablement ouvert » n’existe pas', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const foyer = poserReference(tmp, METIER_COURANT);
  const depot = join(tmp, 'depot');
  // ⚠️ TROIS FAÇONS DE NE PAS SAVOIR, et aucune ne doit se rabattre sur « ouvert » :
  //   • le mandat n'est pas un code de chantier (`matapedia`) ;
  //   • le ServiceDesk refuse de répondre ;
  //   • il répond un statut qu'on ne sait pas lire.
  const sansCode = poserLieu(depot, 'matapedia', METIER_PERIME);
  const injoignable = poserLieu(depot, 'd-20260101-0001', METIER_PERIME);
  const statutInconnu = poserLieu(depot, 'p-20260101-0002', METIER_PERIME);

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: sansCode },
      { pane_id: 'w1:p2', foreground_cwd: injoignable },
      { pane_id: 'w1:p3', foreground_cwd: statutInconnu },
    ],
    roleDuLieu,
    references: { orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }) },
    etatDuMandat: (m) =>
      etatDuMandat(m, {
        appeler: async (famille) => {
          if (famille === 'demands') throw new Error('le service ne répond pas');
          return { status: 'un_statut_de_demain' };
        },
      }),
  });

  assert.equal(rendu.compte.mandatsNonMesures, 3);
  assert.equal(rendu.compte.mandatsOuverts, 0);
  for (const o of rendu.agents) {
    assert.equal(o.chantier.clos, null, `${o.mandat} : « je ne sais pas » n’est ni ouvert ni clos`);
    assert.equal(o.remiseAJour.aProposer, false, `${o.mandat} : on ne propose rien sur un mandat non mesuré`);
    assert.match(o.remiseAJour.pourquoiPas, /pas pu être mesuré/);
  }
  assert.match(rendu.agents[0].chantier.raison, /n’est pas un code de chantier/);
  assert.match(rendu.agents[1].chantier.raison, /n’a pas répondu/);
  assert.match(rendu.agents[2].chantier.raison, /ne m’est pas connu/);
});

test('les statuts qui ferment un chantier viennent du service, et un statut ajouté demain fait TAIRE le module', () => {
  // ⚠️ CE BANC GARDE UNE PROPRIÉTÉ DE CONCEPTION, pas une liste. Si quelqu'un remplaçait le test
  // « ce statut m'est-il connu » par « n'est-il pas dans mes statuts clos », tout statut neuf
  // deviendrait « ouvert » en silence — et le défaut de T-20260819-0056 se rouvrirait tout seul.
  for (const [famille, clos] of Object.entries(STATUTS_CLOS)) {
    for (const statut of clos) {
      assert.ok(STATUTS_CONNUS[famille].includes(statut), `${famille}/${statut} doit être un statut CONNU`);
    }
  }
  assert.equal(familleDuMandat('J-20260814-0002'), 'deliveries');
  assert.equal(familleDuMandat('d-20260819-0001'), 'demands');
  assert.equal(familleDuMandat('matapedia'), null);
  assert.equal(familleDuMandat('general'), null);
});

test('deux sessions herdr qui emploient le même identifiant de pane rendent DEUX orchestrateurs, pas un', async (t) => {
  // ⚠️ CE BANC GARDE UN SOUS-COMPTAGE SILENCIEUX, et le cas est réel : mesuré le 2026-08-19, ce
  // poste porte treize sessions herdr, et `w5:p3` y désigne un pane de `progex` pendant que
  // `w5:p8` en désigne un de `somtech`. Un identifiant de pane n'est unique QUE dans sa session.
  // Dédoublonner sur le seul `pane_id` ferait disparaître de l'inventaire un agent parfaitement
  // vivant parce qu'un homonyme d'une autre session est passé avant lui — et rien ne le dirait.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  poserLieu(depot, 'd-de-la-session-une', METIER_COURANT);
  poserLieu(depot, 'p-de-la-session-deux', METIER_COURANT);

  const poste = posteHerdr(tmp, [], 'deux-sessions');
  poste.panes([{ pane_id: 'w5:p3', foreground_cwd: join(depot, '.orchestrateur', 'd-de-la-session-une') }], 'une');
  poste.panes([{ pane_id: 'w5:p3', foreground_cwd: join(depot, '.orchestrateur', 'p-de-la-session-deux') }], 'deux');

  const avant = { PATH: process.env.PATH, HOME: process.env.HOME };
  let rendu;
  try {
    process.env.PATH = poste.path;
    process.env.FAUX_HERDR_ETAT = poste.etat;
    // Un foyer jetable qui porte EXACTEMENT les deux sessions qu'on veut voir interroger — sans
    // lui, `panes()` agrégerait les sessions du poste réel et ce banc mesurerait la machine.
    const sessions = join(tmp, 'foyer', '.config', 'herdr', 'sessions');
    for (const nom of ['une', 'deux']) {
      mkdirSync(join(sessions, nom), { recursive: true });
      writeFileSync(join(sessions, nom, 'herdr.sock'), '');
    }
    process.env.HOME = join(tmp, 'foyer');
    rendu = await unRecensement({ panes: () => panesDeHerdr(), roleDuLieu });
  } finally {
    process.env.PATH = avant.PATH;
    process.env.HOME = avant.HOME;
    delete process.env.FAUX_HERDR_ETAT;
  }

  assert.ok(rendu.agents, `l’inventaire a refusé (${rendu.inventaireRefuse})`);
  const mandats = rendu.agents.map((o) => o.mandat).sort();
  assert.deepEqual(mandats, ['d-de-la-session-une', 'p-de-la-session-deux'], 'les deux doivent être là');
  // Et chacun porte SA session : sans elle, personne ne pourrait désigner l'un plutôt que l'autre.
  const sessionsRendues = new Set(rendu.agents.map((o) => o.session));
  assert.equal(sessionsRendues.size, 2, 'le registre doit dire DE QUELLE session chaque pane vient');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE COMPTE EST UN PLANCHER — et il le dit lui-même
//
// Le 2026-08-19, le même parc a été compté TROIS, puis CINQ, puis SEPT en une matinée. Ce qui
// changeait à chaque fois était l'INSTRUMENT, jamais le parc. Une seule chose a empêché le
// premier compte d'être publié comme un fait : la marque « plancher » écrite À CÔTÉ du chiffre.

test('le rendu porte la marque « plancher » et son angle mort — pas dans un compte rendu à côté', async () => {
  const rendu = await unRecensement({ panes: [], roleDuLieu });
  assert.equal(rendu.borne.nature, 'plancher');
  assert.match(rendu.resume, /AU MOINS/, 'le résumé ne doit jamais se lire comme un total');
  assert.ok(rendu.borne.angleMort.length >= 3, 'ce qu’on ne peut pas voir est ÉNUMÉRÉ, pas évoqué');
  assert.equal(rendu.borne.angleMort, CE_QUE_LE_RECENSEMENT_NE_VOIT_PAS);
});

test('une session herdr muette AMPUTE le compte — et le rendu le dit au lieu de le taire', async () => {
  // ⚠️ CE BANC GARDE UN SOUS-COMPTAGE SILENCIEUX D'UNE COUCHE PLUS BAS. `panes()` continue quand
  // une session refuse — c'est bon, une session morte ne doit pas invalider les autres — mais le
  // prix doit se voir : trois sessions muettes sur treize amputent le compte d'un quart, et sans
  // ce champ le rendu présenterait ce quart manquant comme un parc complet.
  const rendu = await unRecensement({
    panes: async () => ({
      panes: [],
      sessionsInterrogees: 13,
      sessionsRefusees: [
        { session: '/x/sessions/cg/herdr.sock', raison: 'connexion refusée' },
        { session: '/x/sessions/progex/herdr.sock', raison: 'délai dépassé' },
      ],
    }),
    roleDuLieu,
  });
  assert.equal(rendu.inventaireRefuse, null, 'ce n’est PAS une panne totale : les autres ont répondu');
  assert.equal(rendu.borne.sessionsRefusees.length, 2);
  // Nommées, pas comptées : savoir LAQUELLE s'est tue est ce qui permet d'aller voir.
  assert.match(rendu.borne.sessionsRefusees[0].session, /cg/);
  assert.match(rendu.resume, /amputé/i, 'le résumé doit porter l’amputation, pas seulement le rendu');
  assert.equal(rendu.borne.sessionsInterrogees, 13);
});

test('aucune session muette : le résumé le dit aussi, et reste un plancher', async () => {
  const rendu = await unRecensement({
    panes: async () => ({ panes: [], sessionsInterrogees: 13, sessionsRefusees: [] }),
    roleDuLieu,
  });
  assert.doesNotMatch(rendu.resume, /amputé/i);
  assert.match(rendu.resume, /plancher/, 'même complet, un compte reste un plancher');
});

test('un lieu écarté est NOMMÉ, pas effacé — c’est lui qui chiffre le plancher', async (t) => {
  // ⚠️ MESURÉ EN VRAI le 2026-08-19 : huit chemins candidats sur ce poste, sept comptés, et le
  // huitième portait un agent Claude bien vivant dans un lieu à demi posé — sans CLAUDE.md, sans
  // moyens. L'écarter est juste ; le faire disparaître ne l'était pas : il n'aurait laissé aucune
  // trace nulle part, et personne n'aurait su qu'un agent travaille sans métier (T-20260819-0070).
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const vrai = poserLieu(depot, 'd-20260819-0001', METIER_COURANT);
  const coquille = join(depot, '.orchestrateur', 'p-20260728-0002');
  mkdirSync(join(coquille, 'briefs'), { recursive: true });

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: vrai },
      { pane_id: 'w3:p2', foreground_cwd: coquille },
    ],
    roleDuLieu,
  });

  // Deux agents recensés — la coquille en porte un, bien vivant. Ce qu'on garde est qu'elle
  // ne prend pas le RÔLE de son dossier : le rôle s'établit par le contenu du lieu, jamais par
  // son nom, et un répertoire vide au bon nom ne porte aucun métier.
  assert.equal(rendu.agents.length, 2, 'les deux panes figurent : aucun agent ne s’efface');
  const avecRole = rendu.agents.filter((o) => o.role.mesure === 'établi');
  assert.equal(avecRole.length, 1, 'la coquille ne devient pas un orchestrateur');
  assert.equal(avecRole[0].pane, 'w1:p1', 'et c’est le lieu VRAIMENT posé qui le porte');
  const coq = rendu.agents.find((o) => o.pane === 'w3:p2');
  assert.equal(coq.role.mesure, 'non établi');
  assert.match(coq.role.pourquoi, /demi posé|sans porter le métier/, 'la raison dit ce qui manque');
  assert.equal(rendu.borne.lieuxEcartes.length, 1, 'et l’écart au rôle est chiffré');
  assert.equal(rendu.borne.lieuxEcartes[0].pane, 'w3:p2', 'et on sait QUEL pane, pour aller voir');
  assert.match(rendu.borne.lieuxEcartes[0].lieu, /p-20260728-0002/);
});

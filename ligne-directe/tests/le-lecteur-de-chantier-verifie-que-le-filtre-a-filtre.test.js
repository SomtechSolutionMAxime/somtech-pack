// LE LECTEUR DE CHANTIER VÉRIFIE QUE LE FILTRE A FILTRÉ
// (E-20260822-0002, sous P-20260822-0001 — story T-20260822-0012.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LE PIÈGE EST DOCUMENTÉ, VÉRIFIÉ, ET IL EST SILENCIEUX
//
// `tickets` action `list` **accepte `delivery_id` et l'IGNORE** : on récupère la base entière,
// **d'autres applications comprises**, sans erreur ni avertissement. Un filtre qu'on croit posé
// et qui ne l'est pas ne rend pas une erreur — il rend TROP, et tout a l'air normal.
//
// Appliqué à la vue, ça donne un mensonge parfaitement mis en page : les epics de toutes les
// applications du ServiceDesk rangés sous un orchestrateur qui n'en tient aucun, chacun avec
// l'apparence exacte d'un fait mesuré. C'est le pire mode de panne pour cet outil, dont
// l'objet même est de ne rien affirmer qu'il n'ait établi.
//
// D'où la règle appliquée dans `lecteurDeChantier`, et gardée ici : **on retamise ce que le
// service a rendu, et on compte l'écart.** Le service filtre ou ne filtre pas ; nous, on sait.
//
// ⚠️ CE BANC EST NÉ D'UNE MUTATION SURVIVANTE. Retirer les deux filtres de vérification laissait
// les 19 essais des deux autres fichiers VERTS — la fonction n'était éprouvée par personne.
// Sa garde était vacante au sens strict : elle existait dans le code, rien ne l'exerçait.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lecteurDeChantier } from '../src/vue-du-parc.js';

/**
 * UN SERVICEDESK DE BANC — et il se comporte comme le VRAI, pas comme on l'aimerait.
 *
 * ⚠️ LA LEÇON DU LOT PRÉCÉDENT, APPLIQUÉE ICI : un double plus coopératif que le réel ne rate
 * pas seulement un défaut, il en FABRIQUE dans les gardes qui s'appuient dessus. Ce double
 * IGNORE donc `project_id` et `epic_id` exactement comme le service mesuré le fait — c'est ce
 * qui rend le banc capable d'attraper quelque chose.
 *
 * @param honoreLesFiltres  quand `true`, il filtre comme on l'espérerait. Le défaut est `false`,
 *                          parce que c'est la mesure.
 */
function unServiceDesk({ projets = [], epics = [], tickets = [], honoreLesFiltres = false } = {}) {
  const appels = [];
  const appeler = async (nom, args) => {
    appels.push({ nom, args });
    if (nom === 'projects') return { projects: projets };
    if (nom === 'epics') {
      return { epics: honoreLesFiltres ? epics.filter((e) => e.project_id === args.project_id) : epics };
    }
    if (nom === 'tickets') {
      return { tickets: honoreLesFiltres ? tickets.filter((t) => t.epic_id === args.epic_id) : tickets };
    }
    throw new Error(`outil inattendu : ${nom}`);
  };
  return { appeler, appels };
}

const PROJETS = [
  { id: 'uuid-A', project_id: 'P-20260822-0001', title: 'Voir qui travaille sur quoi', status: 'in_progress' },
  { id: 'uuid-B', project_id: 'P-20260819-0001', title: 'un autre chantier', status: 'in_progress' },
];
const EPICS = [
  { id: 'e-A1', epic_id: 'E-20260822-0002', title: 'La vue du parc', project_id: 'uuid-A', status: 'in_execution' },
  // 🔴 L'INTRUS : il appartient à un AUTRE projet. Un filtre ignoré le fait remonter ici.
  { id: 'e-B1', epic_id: 'E-20260819-0009', title: 'un epic d’ailleurs', project_id: 'uuid-B', status: 'draft' },
];
const TICKETS = [
  { id: 't-1', ticket_id: 'T-20260822-0012', title: 'Joindre par le mandat', epic_id: 'e-A1', status: 'in_progress' },
  // 🔴 L'INTRUS, un étage plus bas.
  { id: 't-2', ticket_id: 'T-20260819-0044', title: 'une story d’ailleurs', epic_id: 'e-B1', status: 'new' },
];

test('un service qui IGNORE son filtre ne fait pas remonter les epics d’un autre chantier — on retamise, et l’écart est compté', async () => {
  const sd = unServiceDesk({ projets: PROJETS, epics: EPICS, tickets: TICKETS, honoreLesFiltres: false });
  const lire = lecteurDeChantier({ appeler: sd.appeler });

  const chantier = await lire('P-20260822-0001');

  assert.deepEqual(
    chantier.epics.map((e) => e.code),
    ['E-20260822-0002'],
    'l’epic d’un AUTRE projet ne doit pas être rangé sous ce chantier'
  );
  // ⚠️ L'ÉCART NE DISPARAÎT PAS : s'il n'est pas nul, le service n'a pas honoré son filtre. Le
  // taire rendrait le retamisage invisible — et personne n'irait voir pourquoi il a servi.
  assert.equal(chantier.epicsEcartes, 1, 'et l’écart est rendu : le filtre du service n’a pas filtré');

  const stories = chantier.epics[0].stories.map((s) => s.code);
  assert.deepEqual(stories, ['T-20260822-0012'], 'la story d’un autre epic ne descend pas sous celui-ci');
});

test('un service qui HONORE son filtre rend le même résultat, avec un écart nul — le retamisage ne retire rien de légitime', async () => {
  const sd = unServiceDesk({ projets: PROJETS, epics: EPICS, tickets: TICKETS, honoreLesFiltres: true });
  const lire = lecteurDeChantier({ appeler: sd.appeler });

  const chantier = await lire('P-20260822-0001');

  // ⚠️ SANS CE SECOND CAS, LA GARDE CI-DESSUS PASSERAIT SUR UN LECTEUR QUI JETTE TOUT. Un filtre
  // trop zélé — qui écarterait aussi les epics légitimes — rendrait la même liste vide qu'un
  // service muet, et le premier banc ne verrait pas la différence.
  assert.deepEqual(chantier.epics.map((e) => e.code), ['E-20260822-0002']);
  assert.equal(chantier.epicsEcartes, 0, 'rien n’a été écarté : le service avait bien filtré');
  assert.equal(chantier.titre, 'Voir qui travaille sur quoi');
  assert.equal(chantier.statut, 'in_progress');
});

test('des stories ILLISIBLES rendent `null`, jamais `[]` — un epic dont on n’a rien lu n’est pas un epic sans travail', async () => {
  const appeler = async (nom, args) => {
    if (nom === 'projects') return { projects: PROJETS };
    if (nom === 'epics') return { epics: [EPICS[0]] };
    throw new Error('HTTP 503');
  };
  const chantier = await lecteurDeChantier({ appeler })('P-20260822-0001');

  assert.equal(chantier.epics[0].stories, null, '« pas pu lire » ≠ « il n’y en a aucune »');
});

test('un chantier ABSENT de la liste jette, et le refus DIT si la liste était plafonnée', async () => {
  // ⚠️ LA TRONCATURE SE DIT, ELLE NE SE TAIT PAS. Une liste rendue exactement à son plafond a
  // très probablement été coupée, et le chantier cherché peut être juste derrière. Sans cette
  // mention, il retomberait en « non mesuré » avec une raison qui n'évoque jamais la vraie
  // cause — et personne n'irait lever le plafond.
  const beaucoup = Array.from({ length: 3 }, (_, i) => ({ id: `u${i}`, project_id: `P-2026010${i}-0001` }));
  const appeler = async (nom) => (nom === 'projects' ? { projects: beaucoup } : { epics: [] });

  await assert.rejects(
    () => lecteurDeChantier({ appeler, limite: 3 })('P-20260822-0001'),
    (err) => {
      assert.ok(err.message.includes('PLAFONNÉE'), 'le plafond atteint est DIT');
      assert.ok(err.message.includes('3'), 'et sa valeur avec');
      return true;
    }
  );

  // Le même chantier absent d'une liste NON plafonnée ne doit pas accuser un plafond qui n'a
  // pas joué : deux causes distinctes, deux messages distincts.
  const court = async (nom) => (nom === 'projects' ? { projects: [beaucoup[0]] } : { epics: [] });
  await assert.rejects(
    () => lecteurDeChantier({ appeler: court, limite: 3 })('P-20260822-0001'),
    (err) => {
      assert.ok(!err.message.includes('PLAFONNÉE'), 'aucun plafond n’est invoqué quand il n’a pas joué');
      return true;
    }
  );
});

test('un mandat qui n’est pas un code de chantier est REFUSÉ par le lecteur — il ne va rien chercher au hasard', async () => {
  const sd = unServiceDesk({ projets: PROJETS });
  await assert.rejects(
    () => lecteurDeChantier({ appeler: sd.appeler })('matapedia'),
    /n’est pas un code de chantier/
  );
  assert.equal(sd.appels.length, 0, 'et le ServiceDesk n’est même pas interrogé');
});

test('sans transport, il n’y a pas de lecteur — `null`, pour que la vue dise « aucun accès » au lieu d’inventer un parc vide', () => {
  assert.equal(lecteurDeChantier({ appeler: null }), null);
  assert.equal(lecteurDeChantier({ appeler: 'pas une fonction' }), null);
});

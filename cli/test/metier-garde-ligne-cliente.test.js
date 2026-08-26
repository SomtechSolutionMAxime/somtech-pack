// metier-garde-ligne-cliente.test.js — la garde qui tient GF-ORC-005.
//
// « Tu ne parles jamais à un client. » Ce garde-fou vivait en PERSONA seule,
// c'est-à-dire nulle part (STD-047 R1). Sa brèche tient sur une ligne de
// terminal — `ligne-directe ouvrir <chantier> --nature client` ouvre le canal
// PRIVÉ où parlent les gens du client — donc elle se ferme sur une ligne de
// terminal.
//
// ⚠️ CE QUE CES TESTS GARDENT AVANT TOUT : que le même geste soit REFUSÉ à
// l'orchestrateur et LAISSÉ au représentant. Une garde qui se tromperait de côté
// n'empêcherait pas un incident — elle empêcherait un représentant de faire son
// travail, et personne ne relierait le symptôme à ce fichier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { juger } from '../src/metier/gardes/ligne-cliente.js';

const OUVRE_CLIENT = 'node $HOME/.somtech/ligne-directe/bin/ligne-directe.js ouvrir acme --titre "Acme" --nature client';

const decision = (cmd, role) => juger({ commande: cmd, role }).decision;

test('l orchestrateur ne peut pas ouvrir un canal client — le garde-fou devient mécanique', () => {
  assert.equal(decision(OUVRE_CLIENT, 'orchestrateur'), 'deny');
});

test('la forme accolée compte autant que la forme séparée — garder une des deux ne garde rien', () => {
  assert.equal(decision('ligne-directe ouvrir acme --nature=client --titre "Acme"', 'orchestrateur'), 'deny');
});

test('le REPRÉSENTANT ouvre la ligne de son client — c est sa définition de poste', () => {
  for (const role of ['gestionnaire-client', 'representant']) {
    assert.equal(decision(OUVRE_CLIENT, role), 'allow', `« ${role} » doit pouvoir ouvrir la ligne de son client`);
  }
});

test('un rôle que la garde n a pas su mesurer fait REFUSER — mais seulement sur le geste', () => {
  assert.equal(decision(OUVRE_CLIENT, undefined), 'deny', 'devant un rôle non mesuré, on refuse plutôt que de supposer');
  assert.equal(decision(OUVRE_CLIENT, 'inconnu'), 'deny');
});

test('⚠️ un rôle non mesuré ne bloque PAS le reste du travail — sinon la garde empêche de travailler', () => {
  // C'est le défaut que l'ordre des étapes de `juger` existe pour éviter : si le
  // rôle était mesuré AVANT le geste, ce refus tomberait sur toutes les commandes
  // d'un lieu dont la forme n'a pas été reconnue.
  for (const c of ['git status', 'herdr agent list', 'ligne-directe dire "le lot est parti"']) {
    assert.equal(decision(c, undefined), 'allow', `« ${c} » n est pas le geste : la garde doit se taire`);
  }
});

test('l orchestrateur ouvre ses lignes INTERNES sans entrave — la garde ne ferme qu une porte', () => {
  for (const c of ['ligne-directe ouvrir d-20260813-0002 --titre "chantier"',
                   'ligne-directe ouvrir dirigeant --titre "ligne dirigeant" --au-dirigeant',
                   'ligne-directe dire "le lot est parti"',
                   'ligne-directe demander "on pousse ?"']) {
    assert.equal(decision(c, 'orchestrateur'), 'allow', `« ${c} » est une ligne interne, pas un canal client`);
  }
});

test('PARLER du geste n est pas le POSER — un orchestrateur en parle, c est dans son métier', () => {
  for (const c of ['echo "on n ouvre jamais --nature client depuis ici"',
                   'grep -rn "nature client" metier/',
                   'ligne-directe --help']) {
    assert.equal(decision(c, 'orchestrateur'), 'allow', `« ${c} » ne pose pas le geste`);
  }
});

test('les trois signes doivent être là ENSEMBLE — deux sur trois ne sont pas le geste', () => {
  assert.equal(decision('ligne-directe ouvrir acme --titre "Acme"', 'orchestrateur'), 'allow', 'sans --nature client');
  assert.equal(decision('ligne-directe dire "acme --nature client"', 'orchestrateur'), 'allow', 'sans « ouvrir »');
  assert.equal(decision('herdr pane run p "ouvrir --nature client"', 'orchestrateur'), 'allow', 'sans la ligne directe');
});

test('une commande absente ne fait pas lever la garde — elle se tait, elle ne juge pas un vide', () => {
  assert.equal(juger({ role: 'orchestrateur' }).decision, 'allow');
  assert.equal(juger({}).decision, 'allow');
});

test('DÉLÉGUER le geste à son représentant passe — c est exactement ce que le garde-fou demande', () => {
  // Le cas qui compte : l orchestrateur DIT à son représentant d ouvrir la ligne.
  // Trois des quatre signes sont là — « ouvrir », « --nature client », un outil de
  // poste — et le refuser interdirait la seule conduite juste. C est aussi ce qui
  // prouve que reconnaître la ligne directe elle-même est nécessaire : sans ce
  // signe, cette commande serait refusée.
  const c = "node $HOME/.somtech/naissance-representant/bin/livrer.js rep-acme --texte 'a toi d ouvrir --nature client'";
  assert.equal(decision(c, 'orchestrateur'), 'allow', 'déléguer le geste n est pas le poser');
});

test('le refus DIT le geste qui débloque — celui qui lit un refus a déjà un problème', () => {
  const r = juger({ commande: OUVRE_CLIENT, role: 'orchestrateur' }).raison;
  assert.match(r, /représentant/, 'le refus doit nommer par qui ce geste passe');
  assert.ok(r.length > 120, 'un refus qui ne dit que « non » renvoie son lecteur à lui-même');
});

test('⚠️ les DEUX refus ne disent pas la même chose — un refus dit ce qu il a MESURÉ', () => {
  // Les deux refusent, donc l issue seule ne les distingue pas. Ce qui les
  // distingue est la cause, et c est elle que lit celui qui est bloqué : « la
  // règle te l interdit » et « je n ai pas su qui tu es » n appellent pas le
  // même geste. Sans cette garde, effacer la règle des rôles ne rougirait rien.
  const parRegle = juger({ commande: OUVRE_CLIENT, role: 'orchestrateur' }).raison;
  const parPrudence = juger({ commande: OUVRE_CLIENT, role: undefined }).raison;

  assert.match(parPrudence, /n a pas su établir|n'a pas su établir/,
    'le refus par prudence doit dire que le rôle n a pas été mesuré');
  assert.doesNotMatch(parRegle, /n a pas su établir|n'a pas su établir/,
    'un orchestrateur est refusé par la RÈGLE, pas parce qu on ignore qui il est');
  assert.notEqual(parRegle, parPrudence);
});

// ─────────────────────────────────────────────────────────────────────────────
// LA TABLE DES RÔLES CONNUS EST DÉSORMAIS COMMUNE AUX DEUX GARDES (T-20260826-0079).
// Ce qui suit garde la frontière que la mise en commun ne doit PAS franchir : ce que
// chaque garde SAIT LIRE est partagé, ce qu'elle DÉCIDE ne l'est pas.
// ─────────────────────────────────────────────────────────────────────────────

test('⚠️ un rôle CONNU mais non autorisé est refusé PAR LA RÈGLE, pas par prudence', async () => {
  // Le cas ne se produit pas encore : `orchestrateur` est aujourd'hui le seul rôle connu
  // qui ne soit pas celui du représentant, et son refus est déjà gardé plus haut. Il se
  // produira au premier des neuf rôles arbitrés (P-20260819-0001). On l'éprouve donc en
  // déclarant un rôle à la table le temps de l'essai — c'est le seul moyen d'exercer la
  // branche sans ouvrir le registre, et sans elle le refus dirait « je n'ai pas su qui tu
  // es » à propos d'un rôle parfaitement établi.
  const { ROLES_CONNUS } = await import('../src/metier/gardes/roles-connus.js');
  ROLES_CONNUS.add('chef-equipe');
  try {
    const r = juger({ commande: OUVRE_CLIENT, role: 'chef-equipe' });
    assert.equal(r.decision, 'deny', 'ouvrir une ligne cliente n appartient qu au représentant');
    assert.doesNotMatch(r.raison, /n a pas su établir|n'a pas su établir/,
      'un rôle que la table connaît est refusé par la RÈGLE : dire le contraire envoie chercher une panne qui n existe pas');
    assert.match(r.raison, /représentant/, 'le refus doit nommer par qui ce geste passe');
  } finally {
    ROLES_CONNUS.delete('chef-equipe');
  }
});

test('⚠️ les rôles AUTORISÉS sont tous connus de la table commune — sinon les deux ont dérivé', async () => {
  const { ROLES_CONNUS } = await import('../src/metier/gardes/roles-connus.js');
  const { ROLES_AUTORISES } = await import('../src/metier/gardes/ligne-cliente.js');
  const inconnus = [...ROLES_AUTORISES].filter((r) => !ROLES_CONNUS.has(r));
  assert.deepEqual(inconnus, [],
    `« ${inconnus.join(', ')} » est autorisé ici mais absent de la table commune : les deux copies `
    + 'du critère ont dérivé, et la garde du terminal bloquerait ce rôle sur tous ses gestes');
});

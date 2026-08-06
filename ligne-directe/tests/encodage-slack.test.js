// L'ENCODAGE DES APPELS À SLACK — le défaut qui a rendu toute la capacité inerte.
//
// Ce que couvrent ces tests n'est pas une subtilité de transport. `appeler()` envoyait
// TOUJOURS un corps JSON. Or `application/x-www-form-urlencoded` est le seul encodage que
// TOUTES les méthodes de Slack servent ; le JSON n'est servi que par une partie des
// méthodes d'écriture. Pour les autres, le corps n'est pas refusé bruyamment — il est
// IGNORÉ, et la méthode s'exécute avec zéro argument.
//
// Conséquence mesurée contre le vrai Slack, et c'est le cœur du chantier :
//   - `conversations.members` échouait SYSTÉMATIQUEMENT (`missing required field: channel`).
//     C'est le SEUL chemin par lequel une ligne cliente apprend qui a le droit d'y écrire.
//     Une ligne cliente naissait donc avec une liste d'autorisés vide, et le premier message
//     de n'importe quelle personne du client tombait dans le refus — pour toujours.
//   - `conversations.list` rendait 43 canaux publics au lieu des 44 demandés : `types`,
//     `limit` et `cursor` étaient jetés. Aucune erreur, aucun bruit.
//
// Chaque test ci-dessous a été vu ROUGE avec l'ancien encodage JSON, puis vert après
// correction. Ils passent par le double strict de `tests/aide/faux-slack.js`, qui n'extrait
// les arguments que là où Slack les extrait vraiment.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fauxSlack } from './aide/faux-slack.js';
import {
  appeler,
  identite,
  ouvrirEcoute,
  creerCanal,
  trouverCanal,
  membresDuCanal,
  rejoindreCanal,
  inviter,
  definirSujet,
  poster,
  renommerCanal,
  archiverCanal,
  trouverMembre,
} from '../src/slack.js';

/** Monte un espace Slack en mémoire pour la durée d'un test, et le démonte quoi qu'il arrive. */
async function avecSlack(etat, corps) {
  const monde = fauxSlack(etat).installer();
  try {
    return await corps(monde);
  } finally {
    monde.restaurer();
  }
}

// ═════════════════════════════════ le double d'abord : une cloison qu'on n'éprouve pas n'en est pas une

test('LE DOUBLE REFUSE LE DÉSARCHIVAGE — Slack ne le sert pas au jeton dont ce code dispose', async () => {
  // Cette cloison ne se prouve que par elle-même : le code n'appelle plus `unarchive`, donc
  // l'assouplir n'a aujourd'hui aucun effet observable ailleurs — et une cloison qui ne se
  // prouve que par son absence d'effet n'en est pas une. Sans ce test, le jour où quelqu'un
  // réintroduit l'appel, il le verra passer au vert contre un double complaisant.
  //
  // C'est la quatrième fois sur ce chantier que le double se montre plus permissif que le
  // service réel, et la première où on s'en aperçoit avant d'y avoir cru.
  await avecSlack({ canaux: [{ id: 'C1', name: 'ligne', is_private: false, is_archived: true, membres: [] }] }, async (monde) => {
    const echec = await appeler('conversations.unarchive', 'jeton-robot', { channel: 'C1' }).then(
      () => null,
      (err) => err
    );
    assert.ok(echec, 'le désarchivage doit échouer');
    assert.equal(echec.code, 'not_allowed_token_type', `code inattendu : ${echec.code}`);
    assert.equal(monde.canalNomme('ligne').is_archived, true, 'et le canal doit rester archivé');
  });
});

test('LE DOUBLE REFUSE CE QUE SLACK REFUSE — un corps JSON sur une méthode de lecture ne porte aucun argument', async () => {
  // Sans cette propriété, tout le reste du fichier ne prouve rien : c'est exactement la
  // permissivité du double précédent qui a laissé 97 tests verts couvrir une fonction morte.
  const monde = fauxSlack({ canaux: [{ id: 'C1', name: 'ligne', is_private: true, membres: ['UMOI', 'UCLIENT'] }] });

  const enJson = await monde.servir('https://slack.com/api/conversations.members', {
    method: 'POST',
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel: 'C1' }),
  });
  const enFormulaire = await monde.servir('https://slack.com/api/conversations.members', {
    method: 'POST',
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'channel=C1',
  });

  const refus = await enJson.json();
  assert.equal(refus.ok, false, 'le double doit refuser le corps JSON, comme le vrai Slack');
  assert.match(refus.detail || '', /missing required field: channel/);
  assert.deepEqual((await enFormulaire.json()).members, ['UMOI', 'UCLIENT']);
});

// ═════════════════════════════════ le défaut bloquant : l'autorisation d'une ligne cliente

test('LES MEMBRES D’UN CANAL PRIVÉ ARRIVENT — c’est la seule liste d’autorisés d’une ligne cliente', async () => {
  // LE défaut. Avec l'ancien encodage, cet appel échouait à chaque fois, contre canal privé
  // comme public : la ligne cliente refusait tout le monde, poliment, définitivement.
  await avecSlack({ canaux: [{ id: 'C_CLI', name: 'd-acme', is_private: true, membres: ['UMOI', 'UCLIENT'] }] }, async () => {
    assert.deepEqual(await membresDuCanal('jeton', 'C_CLI'), ['UMOI', 'UCLIENT']);
  });
});

test('la liste des membres est réellement paginée — au-delà d’une page, personne n’est oublié', async () => {
  // `limit` et `cursor` partaient dans le corps ignoré. Un canal client de plus de 200
  // membres aurait perdu les suivants en silence — le même mode de panne, en plus discret.
  const membres = Array.from({ length: 450 }, (_, i) => `U${i}`);
  await avecSlack({ canaux: [{ id: 'C_GROS', name: 'gros', is_private: true, membres }] }, async (monde) => {
    assert.deepEqual(await membresDuCanal('jeton', 'C_GROS'), membres);
    const pages = monde.appels.filter((a) => a.methode === 'conversations.members');
    assert.equal(pages.length, 3, '450 membres à 200 par page : trois appels, pas un');
    assert.equal(pages[0].args.limit, '200', 'la taille de page doit atteindre Slack');
  });
});

// ═════════════════════════════════ le défaut discret : les canaux privés invisibles

test('UN CANAL PRIVÉ ARCHIVÉ SE RETROUVE — sans quoi la reprise d’une ligne cliente en recrée un', async () => {
  // Avec l'ancien encodage, `types` et `exclude_archived` étaient jetés : Slack rendait ses
  // défauts — canaux publics, archives exclues. Le canal privé d'un client était donc
  // introuvable, et rouvrir sa ligne butait sur `name_taken` sans jamais savoir pourquoi.
  await avecSlack(
    {
      canaux: [
        { id: 'C_PUB', name: 'general', is_private: false },
        { id: 'C_CLI', name: 'd-acme', is_private: true, is_archived: true },
      ],
    },
    async () => {
      const trouve = await trouverCanal('jeton', 'd-acme');
      assert.ok(trouve, 'un canal privé archivé doit se retrouver');
      assert.equal(trouve.id, 'C_CLI');
    }
  );
});

test('la recherche de canal pagine jusqu’au bout — le 1001ᵉ canal existe aussi', async () => {
  const canaux = Array.from({ length: 1200 }, (_, i) => ({ id: `C${i}`, name: `canal-${i}`, is_private: i % 2 === 0 }));
  await avecSlack({ canaux }, async (monde) => {
    assert.equal((await trouverCanal('jeton', 'canal-1150'))?.id, 'C1150');
    const pages = monde.appels.filter((a) => a.methode === 'conversations.list');
    assert.ok(pages.length >= 2, 'au-delà d’une page, le curseur doit repartir');
    assert.equal(pages[1].args.cursor, '1000', 'le curseur rendu par Slack doit revenir vers Slack');
  });
});

// ═════════════════════════════════ toutes les méthodes, pas seulement celles qu’on a sondées

test('TOUTE MÉTHODE QUE LE CODE APPELLE PASSE LE DOUBLE STRICT — les quatorze, pas les trois connues', async () => {
  // Trois méthodes cassées ont été trouvées parce que trois ont été sondées. Ce test ferme
  // la question pour de bon : il exerce chaque méthode réellement appelée par le code, et
  // le double refuse tout argument qui n'atteint pas Slack.
  const utilisateurs = [
    { id: 'U_DIR', name: 'maxime', real_name: 'Maxime', profile: { email: 'maxime@somtech.ca' } },
    { id: 'U_CLI', name: 'claire', real_name: 'Claire', profile: { email: 'claire@acme.com' } },
  ];
  await avecSlack({ canaux: [], utilisateurs }, async (monde) => {
    // auth.test — apps.connections.open
    assert.equal((await identite('jeton')).equipe, 'T_ESSAIS');
    assert.match(await ouvrirEcoute('jeton-ecoute'), /^wss:/);

    // conversations.create (privé, ce que demande une ligne cliente)
    const canal = await creerCanal('jeton', 'd-acme', true);
    assert.equal(canal.prive, true, 'un canal client doit naître privé JUSQUE DANS L’APPEL ÉMIS');

    // conversations.invite — conversations.members
    await inviter('jeton', canal.id, ['U_CLI']);
    assert.deepEqual(await membresDuCanal('jeton', canal.id), ['UMOI', 'U_CLI']);

    // conversations.setPurpose : il avale ses erreurs, donc on regarde l'appel émis
    await definirSujet('jeton', canal.id, 'chantier Acme');
    const sujet = monde.appels.find((a) => a.methode === 'conversations.setPurpose');
    assert.equal(sujet.args.purpose, 'chantier Acme', 'le sujet doit atteindre Slack, pas mourir en route');

    // chat.postMessage
    assert.ok(await poster('jeton', { canal: canal.id, texte: 'bonjour', nom: 'Ligne directe', emoji: '📻' }));
    assert.equal(monde.postes[0].text, 'bonjour');
    assert.equal(monde.postes[0].unfurl_links, 'false', 'les options du message doivent survivre à l’encodage');

    // conversations.rename
    assert.equal((await renommerCanal('jeton', canal.id, 'd-acme-2')).nom, 'd-acme-2');

    // users.lookupByEmail, puis users.list en repli
    assert.equal(await trouverMembre('jeton', 'claire@acme.com'), 'U_CLI');
    assert.equal(await trouverMembre('jeton', 'maxime'), 'U_DIR', 'le repli par l’annuaire doit marcher aussi');

    // conversations.join sur un canal public
    const publique = await creerCanal('jeton', 'd-interne', false);
    await rejoindreCanal('jeton', publique.id);

    // conversations.archive
    assert.equal(await archiverCanal('jeton', publique.id), true);
    assert.equal(monde.canalNomme('d-interne').is_archived, true, 'archiver doit archiver POUR DE VRAI');

    // La reprise d'un canal ARCHIVÉ — et ce test affirmait le contraire de ce qui est vrai.
    //
    // Il disait « la reprise doit sortir le canal des archives », et il passait, parce que
    // le double acceptait un désarchivage que Slack refuse à un jeton de robot. Trois
    // affirmations fausses ont été trouvées sur ce lot ; celle-ci était la plus coûteuse,
    // parce qu'elle certifiait un rattrapage inexistant sur des canaux clients qui, eux,
    // sont définitivement perdus une fois archivés.
    const echec = await creerCanal('jeton', 'd-interne', false).then(
      () => null,
      (err) => err
    );
    assert.equal(echec?.name, 'CanalArchive', `reprendre un canal archivé doit échouer : ${echec?.message}`);
    assert.equal(monde.canalNomme('d-interne').is_archived, true, 'et le canal reste archivé');
    assert.deepEqual(
      monde.appels.filter((a) => a.methode === 'conversations.unarchive'),
      [],
      'aucun désarchivage tenté : on sait qu’il échouerait'
    );

    const methodes = new Set(monde.appels.map((a) => a.methode));
    for (const attendue of [
      'auth.test',
      'apps.connections.open',
      'conversations.create',
      'conversations.list',
      'conversations.members',
      'conversations.join',
      'conversations.invite',
      'conversations.setPurpose',
      'conversations.rename',
      'conversations.archive',
      // `conversations.unarchive` ne figure plus ici : le code ne l'appelle plus, parce
      // qu'il ne le peut pas. Une méthode listée mais jamais appelée est le contraire de ce
      // que ce test existe pour prouver.
      'chat.postMessage',
      'users.lookupByEmail',
      'users.list',
    ]) {
      assert.ok(methodes.has(attendue), `${attendue} doit avoir été exercée par ce test`);
    }
  });
});

test('AUCUN APPEL N’EST ÉMIS EN JSON — la règle est vérifiée sur le transport, pas sur l’intention', async () => {
  // Le garde-fou de tout ce qui précède : un futur appel ajouté en JSON par distraction
  // repartirait dans le mode de panne silencieux. On regarde donc l'en-tête émis.
  await avecSlack({ canaux: [{ id: 'C1', name: 'ligne', is_private: true, membres: ['UMOI'] }] }, async (monde) => {
    await identite('jeton');
    await membresDuCanal('jeton', 'C1');
    await poster('jeton', { canal: 'C1', texte: 'bonjour' });
    for (const appel of monde.appels) {
      assert.match(appel.type, /application\/x-www-form-urlencoded/, `${appel.methode} doit partir en formulaire`);
    }
  });
});

test('une valeur absente ne part pas comme le mot « undefined »', async () => {
  // Piège propre au formulaire : là où JSON.stringify laisse simplement tomber la clé,
  // une concaténation naïve enverrait `cursor=undefined`. Slack le prendrait pour un vrai
  // curseur et rendrait une page vide — la pagination s'arrêterait au premier tour.
  await avecSlack({ canaux: [{ id: 'C1', name: 'ligne', is_private: true, membres: ['UMOI'] }] }, async (monde) => {
    await membresDuCanal('jeton', 'C1');
    const premier = monde.appels.find((a) => a.methode === 'conversations.members');
    assert.equal(premier.args.cursor, undefined, 'un curseur absent ne doit pas partir du tout');
  });
});

test('une erreur de Slack reste lisible telle quelle — l’encodage ne masque pas le motif', async () => {
  await avecSlack({ canaux: [] }, async () => {
    await assert.rejects(() => appeler('conversations.members', 'jeton', { channel: 'C_ABSENT' }), (err) => {
      assert.equal(err.name, 'ErreurSlack');
      assert.equal(err.code, 'channel_not_found');
      return true;
    });
  });
});

test('files.info APPARTIENT À LA FAMILLE FORMULAIRE — mesuré contre le vrai Slack le 2026-08-06', async () => {
  // CINQUIÈME FOIS que le double serait plus permissif que le service qu'il imite, et c'est
  // ce piège précis qui a rendu un lot entièrement inerte : `files.info` répond 200 en
  // formulaire et refuse en JSON avec `invalid_arguments`. Un double qui servirait le corps
  // JSON laisserait passer un code qui, en production, interrogerait Slack avec ZÉRO argument
  // — et rendrait « pièce introuvable » sur chaque capture caviardée.
  const monde = fauxSlack({ infosFichiers: { F9: { id: 'F9', name: 'image.png', mimetype: 'image/png', size: 317919 } } });

  const enJson = await monde.servir('https://slack.com/api/files.info', {
    method: 'POST',
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ file: 'F9' }),
  });
  const enFormulaire = await monde.servir('https://slack.com/api/files.info', {
    method: 'POST',
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'file=F9',
  });

  const refus = await enJson.json();
  assert.equal(refus.ok, false, 'le double doit refuser le corps JSON, comme le vrai Slack');
  assert.match(refus.detail || '', /missing required field: file/);
  assert.equal((await enFormulaire.json()).file.mimetype, 'image/png');
});

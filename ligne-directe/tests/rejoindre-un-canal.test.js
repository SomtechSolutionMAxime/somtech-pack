// ON NE REJOINT PAS UN CANAL QU'ON A DÉJÀ REJOINT.
//
// LE DÉFAUT, MESURÉ CONTRE LE VRAI SLACK LE 2026-08-06, sur le premier gestionnaire client
// réel : le dirigeant avait invité le robot dans son canal privé `#site-web-somtech`.
//
//     conversations.info → is_private = True | is_member = True
//
// Le robot y était donc DÉJÀ. Mais le chemin de reprise d'un canal existant appelait
// `conversations.join` sans jamais poser la question, Slack refusait (`missing_scope` : le
// droit `channels:join` n'est pas accordé à l'application), et la ligne ne s'inscrivait pas.
// Tout ce que le client écrivait était perdu — le silence exact que ce dispositif existe
// pour supprimer.
//
// Trois faits ferment le sujet du droit manquant, et c'est pour ça qu'aucun droit Slack
// n'est demandé ici :
//   1. rejoindre est INUTILE — le robot est déjà dedans ;
//   2. rejoindre est IMPOSSIBLE — un robot ne rejoint pas un canal privé, on l'y invite ;
//   3. `channels:join` ne couvre que les canaux PUBLICS : l'accorder ne réglerait pas ce cas.
//
// POURQUOI 97 TESTS VERTS N'AVAIENT RIEN VU : le double répondait `ok` là où Slack refuse.
// Un double plus permissif que le service qu'il imite ne teste rien. Les deux premiers tests
// de ce fichier éprouvent donc le DOUBLE avant d'éprouver le code — une cloison qu'on
// n'éprouve pas n'en est pas une.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';
import { appeler, creerCanal, InvitationRequise, RefusDefinitif } from '../src/slack.js';

let Veilleur, sauverRegistre, chargerRegistre;
let racine;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-rejoindre-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre } = await import('../src/registre.js'));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [] }));

/** Monte un espace Slack en mémoire pour la durée d'un test, et le démonte quoi qu'il arrive. */
async function avecSlack(etat, corps) {
  const monde = fauxSlack(etat).installer();
  try {
    return await corps(monde);
  } finally {
    monde.restaurer();
  }
}

const joints = (monde) => monde.appels.filter((a) => a.methode === 'conversations.join');

// ═════════════════════════════ le double d'abord

test('LE DOUBLE DIT SI LE ROBOT EST MEMBRE — et il le dit dans les deux sens', async () => {
  // `is_member` est le fait qui décide de tout ce fichier. Un double qui l'omet rend la
  // question intestable : le code retomberait sur `undefined`, se croirait dehors, et
  // rejoindrait — c'est-à-dire exactement le défaut qu'on corrige, reproduit par le double.
  await avecSlack(
    {
      canaux: [
        { id: 'C_DEDANS', name: 'site-web-somtech', is_private: true, membres: ['UMOI', 'UDIR'] },
        { id: 'C_DEHORS', name: 'salon-equipe', is_private: false, membres: ['UDIR'] },
      ],
    },
    async () => {
      const dedans = await appeler('conversations.info', 'jeton', { channel: 'C_DEDANS' });
      assert.equal(dedans.channel.is_member, true, 'le robot est dans les membres : le double doit le dire');

      const dehors = await appeler('conversations.info', 'jeton', { channel: 'C_DEHORS' });
      assert.equal(dehors.channel.is_member, false, 'et il doit dire NON quand il n’y est pas');

      // Le chemin de reprise passe par la LISTE, pas par la fiche : c'est là que le fait doit
      // voyager, sinon le code paie un appel plafonné de plus à chaque ouverture.
      const liste = await appeler('conversations.list', 'jeton', {
        types: 'public_channel,private_channel',
        limit: 1000,
      });
      const parNom = Object.fromEntries(liste.channels.map((c) => [c.name, c.is_member]));
      assert.deepEqual(parNom, { 'site-web-somtech': true, 'salon-equipe': false });
    }
  );
});

test('LE DOUBLE REFUSE DE REJOINDRE — comme Slack l’a refusé, pour la raison où Slack le refuse', async () => {
  // Deux refus distincts, et les confondre coûte une réinstallation de l'application pour rien :
  //   - `missing_scope` : le droit `channels:join` n'est pas accordé — c'est le refus MESURÉ
  //     en production, et il tombe avant même que Slack regarde le canal ;
  //   - `method_not_supported_for_channel_type` : même avec le droit, un canal PRIVÉ ne se
  //     rejoint pas. C'est ce fait-là qui rend l'octroi du droit inutile pour ce défaut.
  await avecSlack(
    { canaux: [{ id: 'C_PUB', name: 'salon-equipe', is_private: false, membres: ['UDIR'] }] },
    async () => {
      const sansDroit = await appeler('conversations.join', 'jeton', { channel: 'C_PUB' }).then(
        () => null,
        (err) => err
      );
      assert.equal(sansDroit?.code, 'missing_scope', `refus attendu, obtenu : ${sansDroit?.code}`);
    }
  );

  await avecSlack(
    {
      droitRejoindre: true,
      canaux: [{ id: 'C_PRIV', name: 'site-web-somtech', is_private: true, membres: ['UDIR'] }],
    },
    async (monde) => {
      const prive = await appeler('conversations.join', 'jeton', { channel: 'C_PRIV' }).then(
        () => null,
        (err) => err
      );
      assert.equal(prive?.code, 'method_not_supported_for_channel_type', `refus attendu, obtenu : ${prive?.code}`);
      assert.deepEqual(
        monde.canalNomme('site-web-somtech').membres,
        ['UDIR'],
        'et le refus doit être RÉEL : personne n’entre dans le canal'
      );
    }
  );
});

// ═════════════════════════════ la cause : la question n’était jamais posée

test('LA CAUSE — reprendre un canal dont on est DÉJÀ membre ne tente aucun join', async () => {
  // Le cas de production, à l'identique : canal privé, robot invité à la main par le dirigeant.
  //
  // L'assertion qui compte est le COMPTE D'APPELS, pas le succès : un correctif qui se
  // contenterait d'avaler le refus de `conversations.join` rendrait bien `reutilise: true`,
  // et laisserait le code taper une méthode plafonnée à chaque reprise pour rien.
  await avecSlack(
    { canaux: [{ id: 'C0BNDJKC66P', name: 'site-web-somtech', is_private: true, membres: ['UMOI', 'UDIR'] }] },
    async (monde) => {
      const canal = await creerCanal('jeton-robot', 'site-web-somtech', true);

      assert.equal(canal.reutilise, true, 'le canal existant doit être REPRIS, pas recréé');
      assert.equal(canal.id, 'C0BNDJKC66P');
      assert.equal(canal.prive, true, 'et sa confidentialité rendue est celle du canal réel');
      assert.deepEqual(joints(monde), [], 'aucun join ne doit être tenté : on y est déjà');
    }
  );
});

test('LA CAUSE, autre porte — un canal PUBLIC où le robot figure déjà ne se rejoint pas non plus', async () => {
  // Les lignes internes vivent dans des canaux publics. Trois fois sur ce chantier, un
  // correctif n'a couvert qu'une porte sur deux ; celle-ci est l'autre. Sans cette
  // couverture, les dix lignes internes vivantes casseraient à leur première reprise.
  await avecSlack(
    { canaux: [{ id: 'C_INT', name: 'd-20260805-0005', is_private: false, membres: ['UMOI'] }] },
    async (monde) => {
      const canal = await creerCanal('jeton-robot', 'd-20260805-0005', false);

      assert.equal(canal.reutilise, true);
      assert.equal(canal.prive, false);
      assert.deepEqual(joints(monde), [], 'aucun join : le robot est déjà dans ce canal public');
    }
  );
});

// ═════════════════════════════ le symptôme : quand il reste un refus, il se nomme

test('LE SYMPTÔME — quand rejoindre est vraiment refusé, le refus NOMME le geste humain qui le lève', async () => {
  // Il reste un cas où le join part : un canal existant où le robot ne figure pas. Slack le
  // refuse (le droit n'est pas accordé, et il ne réglerait rien pour un canal privé). Ce
  // refus doit dire ce qu'il faut faire — FAIRE INVITER LE ROBOT PAR UN HUMAIN — plutôt que
  // de tomber en panne muette deux lignes après le garde-fou.
  await avecSlack(
    { canaux: [{ id: 'C_ETRANGER', name: 'salon-equipe', is_private: false, membres: ['UDIR'] }] },
    async (monde) => {
      const echec = await creerCanal('jeton-robot', 'salon-equipe', false).then(
        () => null,
        (err) => err
      );

      assert.ok(echec, 'reprendre un canal où l’on n’est pas doit échouer');
      assert.equal(echec.name, 'InvitationRequise', `erreur inattendue : ${echec?.message}`);
      assert.ok(echec instanceof InvitationRequise);
      // Le FAIT, pas un vocabulaire : c'est lui que l'appelant lit, et c'est lui qui rend le
      // contresens détectable. Un refus qui dirait « réessaie » en portant `reessayable:false`
      // se contredirait — et remplacer tout le texte ne suffirait pas à passer ce test.
      assert.ok(echec instanceof RefusDefinitif, 'réessayer ne changera rien, et le code doit pouvoir le lire');
      assert.equal(echec.reessayable, false);
      assert.equal(echec.geste, 'invitation_humaine', 'le geste qui lève l’impasse doit être lisible sans lire la phrase');
      assert.equal(echec.canal, 'salon-equipe', 'et le refus doit nommer DE QUEL canal il parle');

      assert.equal(joints(monde).length, 1, 'un seul essai : on ne s’acharne pas sur un refus définitif');
      assert.ok(
        !monde.canalNomme('salon-equipe').membres.includes('UMOI'),
        'et rien n’est entré dans le canal — le refus est réel, pas cosmétique'
      );
    }
  );
});

test('LE SYMPTÔME, jusqu’à l’usager — le veilleur rend le refus en clair, jamais une trace de pile', async () => {
  await avecSlack(
    { canaux: [{ id: 'C_ETRANGER', name: 'salon-equipe', is_private: false, membres: ['UDIR'] }] },
    async () => {
      const v = new Veilleur({
        cheminSocket: join(racine, 'refus.sock'),
        jetons: { robot: 'jeton-robot', ecoute: 'jeton-ecoute' },
        identite: { equipe: 'T', utilisateur: 'UMOI' },
        herdr: { async vivant() { return true; }, async remettre() { return {}; }, async agents() { return []; } },
      });

      const r = await v.ouvrir({ chantier: 'D-1', pane: 'w1:p1', worktree: '/w/a', titre: 'salon equipe' });

      assert.equal(r.ok, false, 'la ligne ne s’ouvre pas : le robot n’est pas dans ce canal');
      assert.match(r.erreur, /salon-equipe/, 'le refus doit nommer le canal en cause');
      assert.deepEqual(chargerRegistre().lignes, [], 'et rien n’est inscrit : le registre ne ment pas');
    }
  );
});

// ═════════════════════════════ bout en bout : le cas qui bloque le premier client réel

test('LE CAS DE PRODUCTION — la ligne s’ouvre sur le canal privé où le dirigeant a invité le robot', async () => {
  // C'est le test qui vaut le chantier : avant le correctif, `ouvrir` mourait sur le join et
  // le registre restait vide — donc chaque message du client tombait dans `canalSansLigne`.
  await avecSlack(
    {
      canaux: [{ id: 'C0BNDJKC66P', name: 'site-web-somtech', is_private: true, membres: ['UMOI', 'UDIR'] }],
      utilisateurs: [{ id: 'UDIR', name: 'maxime', real_name: 'Maxime', profile: { email: 'maxime@somtech.ca' } }],
    },
    async (monde) => {
      const v = new Veilleur({
        cheminSocket: join(racine, 'production.sock'),
        jetons: { robot: 'jeton-robot', ecoute: 'jeton-ecoute' },
        identite: { equipe: 'T', utilisateur: 'UMOI' },
        herdr: { async vivant() { return true; }, async remettre() { return {}; }, async agents() { return []; } },
      });

      const r = await v.ouvrir({
        chantier: 'D-20260805-0004',
        pane: 'w1:p1',
        worktree: '/w/a',
        nature: 'client',
        titre: 'Site web Somtech',
      });

      assert.equal(r.ok, true, `la ligne doit s’ouvrir : ${r.erreur}`);
      assert.equal(r.canal, 'site-web-somtech');
      assert.equal(r.canal_id, 'C0BNDJKC66P', 'et sur LE canal du client, pas un homonyme neuf');
      assert.equal(r.nature, 'client');

      const inscrite = chargerRegistre().lignes.find((l) => l.canal_id === 'C0BNDJKC66P');
      assert.ok(inscrite, 'la ligne doit être au registre — sans elle, chaque message du client se perd');
      assert.equal(inscrite.nature, 'client', 'et inscrite pour ce qu’elle est : le registre décide du langage tenu');
      assert.deepEqual(joints(monde), [], 'aucun join sur tout le parcours');
    }
  );
});

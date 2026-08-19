// LE TRANSPORT DU MANDAT — SA CLOISON, SON REPLI, ET SON INDEX (E-20260819-0005).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE BANC FERME, ET IL A ÉTÉ TROUVÉ EN PASSE DE REVUE DE FOND
//
// `accesServiceDesk` construit un transport HTTP RÉEL et lit la clé du poste dans
// l'environnement. Il n'avait aucune cloison d'essais. Or sur un poste de développement,
// `SOMTECH_DESK_API_KEY` EST exportée — c'est le cas normal de quiconque travaille dans un lieu
// d'agent. **Un simple `npm test` faisait donc partir des POST réels vers le ServiceDesk de
// production, avec la vraie clé**, pour lire le statut de la demande qui porte ce lot. Rien ne
// distinguait une exécution propre d'une exécution qui venait de parler à la prod.
//
// La discipline existait déjà à côté (`slack.js`, `cloison.js`), avec son incident à l'appui :
// une suite d'essais a tenu une connexion Slack de production pendant des heures. Le transport
// neuf n'en héritait pas — « une porte sur deux », appliqué à une cloison.
//
// ⚠️ ET CE BANC ÉPROUVE AUSSI CE QUE PERSONNE N'ÉPROUVAIT : le repli `get` → `list`, et l'index
// par code. Le seul chemin testé jusque-là passait un double à la place de `appeler`, donc
// contournait `accesServiceDesk` en entier — l'heuristique qui décide du statut, et donc de
// `remiseAJour.aProposer`, n'était gardée par rien.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { accesServiceDesk, etatDuMandat, CHAMP_DU_CODE } from '../src/mandat.js';

/** Une réponse MCP telle que le vrai service la rend : du JSON dans du texte dans une enveloppe. */
const enveloppe = (corps) => ({
  ok: true,
  json: async () => ({ result: { content: [{ type: 'text', text: JSON.stringify(corps) }] } }),
});

test('sous le lanceur d’essais, un appel au ServiceDesk avec le transport NATIF est REFUSÉ', async () => {
  // ⚠️ ON NE REMPLACE RIEN : c'est exactement la situation d'un `npm test` ordinaire sur un poste
  // qui porte la clé. Si la cloison tombe, cet appel part vers la production.
  const acces = accesServiceDesk({ cle: 'une-cle-de-poste', fetcher: globalThis.fetch });
  assert.ok(acces, 'l’accès doit se construire — la cloison mord à l’APPEL, pas à la construction');
  await assert.rejects(() => acces('demands', 'D-20260819-0001'), /CLOISON D'ESSAIS/);
});

test('le refus NOMME ce qui serait parti et où — un refus muet n’apprend rien', async () => {
  const acces = accesServiceDesk({ cle: 'k', fetcher: globalThis.fetch, url: 'https://exemple.test/mcp' });
  await assert.rejects(
    () => acces('deliveries', 'J-20260814-0002'),
    (err) => {
      assert.match(err.message, /deliveries/);
      assert.match(err.message, /exemple\.test/);
      // ⚠️ ET LA CLÉ N'Y FIGURE PAS. Un message de refus qui recopierait le secret le déposerait
      // dans le journal du veilleur, c'est-à-dire à l'endroit exact d'où ce dépôt cherche à le tenir.
      assert.doesNotMatch(err.message, /\bk\b/);
      return true;
    }
  );
});

test('un banc qui a monté son double passe la cloison — sinon la garde serait inéprouvable', async () => {
  const acces = accesServiceDesk({ cle: 'k', fetcher: async () => enveloppe({ demand: { status: 'in_progress' } }) });
  const vu = await acces('demands', 'D-20260819-0001');
  assert.equal(vu.status, 'in_progress');
});

test('quand « get » ne rend aucun statut, le transport RETOMBE sur la liste et trouve le code', async () => {
  // Mesuré le 2026-08-19 : `get` par code lisible ne sert que les tickets. Les livraisons et les
  // projets rendent une réponse SANS CONTENU — 3 mandats codés sur 5 tombaient en « non mesuré »
  // sans qu'aucune erreur ne le dise (T-20260819-0066).
  const appels = [];
  const acces = accesServiceDesk({
    cle: 'k',
    fetcher: async (url, options) => {
      const args = JSON.parse(options.body).params.arguments;
      appels.push(args.action);
      if (args.action === 'get') return { ok: true, json: async () => ({ result: { content: [] } }) };
      return enveloppe({
        deliveries: [
          { delivery_id: 'J-20260810-0012', status: 'draft' },
          { delivery_id: 'J-20260814-0002', status: 'in_progress' },
        ],
      });
    },
  });
  const vu = await acces('deliveries', 'J-20260814-0002');
  assert.equal(vu.status, 'in_progress');
  assert.deepEqual(appels, ['get', 'list'], 'on tente le direct d’abord, la liste ensuite');
});

test('l’index ne retient QUE le champ de code de la famille — un code référencé n’est pas le sien', async () => {
  // ⚠️ RELEVÉ EN PASSE DE FOND. La première version balayait tous les champs `*_id` et indexait
  // toute valeur qui ressemblait à un code. Ici, le premier ticket RÉFÉRENCE `T-20260819-0002`
  // sans être lui : l'indexer sur ce code aurait rendu le statut du VOISIN — et ce statut décide
  // de `remiseAJour.aProposer`.
  const acces = accesServiceDesk({
    cle: 'k',
    fetcher: async (url, options) => {
      if (JSON.parse(options.body).params.arguments.action === 'get') {
        return { ok: true, json: async () => ({ result: { content: [] } }) };
      }
      // ⚠️ L'ORDRE EST LA PIÈCE, et il a fallu une mutation pour le voir : avec le référençant
      // EN PREMIER, l'entrée fautive était écrasée par la bonne juste après, et le banc restait
      // vert sur un code qui balayait tous les champs. Le référençant vient donc EN DERNIER —
      // c'est le seul ordre où le défaut se voit, et rien ne garantit l'ordre du service.
      return enveloppe({
        tickets: [
          { ticket_id: 'T-20260819-0002', status: 'in_progress' },
          { ticket_id: 'T-20260819-0001', epic_id: 'T-20260819-0002', status: 'completed' },
        ],
      });
    },
  });
  const vu = await acces('tickets', 'T-20260819-0002');
  assert.equal(vu.status, 'in_progress', 'c’est SON statut, pas celui de qui le référence');
  assert.equal(CHAMP_DU_CODE.tickets, 'ticket_id');
});

test('une liste PLAFONNÉE le dit dans son refus — sinon on chercherait la panne ailleurs', async () => {
  const acces = accesServiceDesk({
    cle: 'k',
    parPage: 2,
    fetcher: async (url, options) => {
      if (JSON.parse(options.body).params.arguments.action === 'get') {
        return { ok: true, json: async () => ({ result: { content: [] } }) };
      }
      return enveloppe({ projects: [{ project_id: 'P-1', status: 'x' }, { project_id: 'P-2', status: 'y' }] });
    },
  });
  await assert.rejects(() => acces('projects', 'P-20260815-0002'), /PLAFONN/);
});

test('un transport qui refuse ne fait pas conclure « ouvert » — il fait dire « non mesuré »', async () => {
  const acces = accesServiceDesk({ cle: 'k', fetcher: async () => ({ ok: false, status: 503 }) });
  const etat = await etatDuMandat('d-20260819-0001', { appeler: acces });
  assert.equal(etat.mesure, 'non mesurée');
  assert.equal(etat.clos, null, '« je ne sais pas » n’est ni ouvert ni clos');
  assert.match(etat.raison, /503/);
});

test('sans clé, aucun accès n’est construit — et on ne devine pas pour autant', async () => {
  assert.equal(accesServiceDesk({ cle: '', fetcher: async () => ({}) }), null);
  const etat = await etatDuMandat('d-20260819-0001', { appeler: null });
  assert.equal(etat.clos, null);
  assert.match(etat.raison, /aucun accès/);
});

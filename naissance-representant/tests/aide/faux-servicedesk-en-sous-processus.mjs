// faux-servicedesk-en-sous-processus.mjs — LE SERVICEDESK, REMPLACÉ À LA FRONTIÈRE DU RÉSEAU,
// dans un processus qu'un fichier de test ne contrôle plus.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE
//
// `bin/naitre.js` est un exécutable : ce qu'il écrit sur sa sortie d'erreur ne peut être
// observé qu'en le LANÇANT. Or ce qu'il dit du ServiceDesk dépend de ce que le ServiceDesk
// répond — et un sous-processus ne partage ni la mémoire ni les modules de son parent. Injecter
// `appelerMcp` comme le font les bancs de `declaration.test.js` est donc impossible ici : c'est
// exactement le trou que ce double vient fermer. Un banc qui appellerait la fonction pure au
// lieu du binaire ne mesurerait rien du LIEU où elle est appelée.
//
// ⚠️ IL SE CHARGE PAR `--import`, AVANT LE BINAIRE, et l'ordre à l'intérieur EST le contrat :
// `mandat.js` est importé D'ABORD, pour qu'il capture le VRAI `globalThis.fetch` dans son
// `TRANSPORT_NATIF`. Remplacer `fetch` avant lui ferait capturer le double comme s'il était le
// transport natif — et la cloison d'essais de `ligne-directe/src/cloison.js`, qui compare les
// deux, refuserait alors l'appel en croyant qu'il part dehors.
//
// ⚠️ CE QU'IL NE FAIT PAS : ouvrir une porte. La cloison reste armée dans le sous-processus
// (`NODE_TEST_CONTEXT` est posée par le lanceur de tests et se transmet à toute la descendance
// — mesuré). Si ce double n'était PAS installé, un appel ne partirait pas vers la production :
// il serait REFUSÉ. Le pire échec de ce fichier est donc un essai qui rougit, jamais un POST
// réel.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QU'IL REND, ET D'OÙ LA FORME VIENT
//
// L'enveloppe est celle que `transportServiceDesk` DÉPLIE, relevée sur son code (mandat.js) :
// il lit `enveloppe.result.content[0].text` et le passe à `JSON.parse`. Un double qui rendrait
// la charge nue serait plus indulgent que le vrai — le motif que `naitre-bin.test.js` documente
// en tête et refuse.
//
// Les charges, elles, ne sont PAS inventées ici : elles viennent du scénario, que le banc
// compose avec les mêmes fabriques que `declaration.test.js` (`unTicketVivant`), lesquelles
// portent la forme mesurée du service.

import { readFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));

// ⚠️ D'ABORD — voir l'en-tête. `mandat.js` doit capturer le vrai transport avant qu'on le
// remplace, sinon la cloison prend le double pour le natif et refuse l'appel.
await import(pathToFileURL(resolve(ICI, '..', '..', '..', 'ligne-directe', 'src', 'mandat.js')).href);

const SCENARIO = JSON.parse(readFileSync(process.env.FAUX_DESK_SCENARIO, 'utf8'));
const JOURNAL = process.env.FAUX_DESK_JOURNAL;

globalThis.fetch = async (url, init) => {
  const corps = JSON.parse(String(init?.body ?? '{}'));
  const outil = corps?.params?.name;
  const args = corps?.params?.arguments ?? {};
  // Le journal existe pour une seule raison : prouver que le binaire a RÉELLEMENT parlé à ce
  // double. Un essai vert dont le double n'a jamais été touché ne mesure pas ce qu'il annonce.
  if (JOURNAL) appendFileSync(JOURNAL, `${JSON.stringify({ url: String(url), outil, args })}\n`);

  const charge = SCENARIO[`${outil}:${args.action}`];
  if (charge === undefined) {
    // ⚠️ CE QU'IL NE CONNAÎT PAS, IL LE REFUSE — même règle que le faux herdr. Un double qui
    // dirait « d'accord » à tout laisserait passer un appel que le vrai service rejette.
    return { ok: false, status: 400, json: async () => ({}) };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify(charge) }] } }),
  };
};

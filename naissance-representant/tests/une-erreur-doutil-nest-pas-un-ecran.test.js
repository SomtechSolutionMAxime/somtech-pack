// une-erreur-doutil-nest-pas-un-ecran.test.js — LE VERBE DE LECTURE, ET CE QU'ON FAIT D'UN
// REFUS D'OUTIL (T-20260821-0024, E-20260821-0003).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 DEUX DÉFAUTS QUI SE CACHENT L'UN DERRIÈRE L'AUTRE, ET UN SEUL SYMPTÔME : `illisible`.
//
// ① LE VERBE EST CHOISI SUR UN CHAMP QUI N'EXISTE PAS.
//
// `trouverDestinataire` rend `{ ok: true, nom: null, parLePane: true }` quand il a trouvé la
// cible PAR SON PANE — le registre herdr l'ignorant, ce qui est le cas NORMAL des agents neufs.
// `bin/etat-boite.js` lisait ce résultat et écrivait `{ ...parAgent, parPane: false }` : **deux
// noms pour le même fait**, et le second écrasait le premier par `false`. La lecture partait
// donc en `herdr agent read` sur un pane qu'aucun agent n'occupe au registre.
//
// ② ET LE REFUS DE L'OUTIL ÉTAIT LU COMME UN ÉCRAN.
//
// `herdr agent read` rend alors, sur STDOUT et avec un code de sortie 1 :
//
//     {"error":{"code":"agent_not_found","message":"agent target w0:p24 not found"}}
//
// `lireEcran` interceptait l'échec et rendait `err.stdout` — c'est-à-dire ce JSON, traité comme
// le terminal du destinataire. Aucun filet dedans, donc `contenuBoite` rendait `null`, donc
// `illisible`.
//
// > **« Je n'ai pas pu lire » et « je ne reconnais pas cet écran » sont deux faits différents.
// > Le second est un verdict sur l'écran d'autrui ; le premier est un aveu sur soi.**
//
// 🔴 CE QUE ÇA COÛTAIT, MESURÉ LE 2026-08-21 : sur les 297 lectures du poste, **23 verdicts
// `illisible` disparaissent par le seul choix du verbe** — dont `w0:p24`, `w0:p25` et `w31:p3`,
// trois des quatre cas de référence du coordonnateur. Et un `illisible` se lit « rien à
// signaler » : un orchestrateur est resté injoignable des dizaines de tours par ce trou.
//
// ⚠️ CE BANC UTILISE UN DOUBLE FIDÈLE, ET C'EST LA MOITIÉ QUI COMPTE. Le double du banc voisin
// rend l'écran même quand il n'y a pas d'agent — plus cohérent que le vrai service, donc
// incapable de produire le défaut. Ici, `agent read` ÉCHOUE quand le registre ne connaît
// personne, exactement comme herdr le fait.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(resolve(HERE, '..'), 'bin', 'etat-boite.js');

let bac;
let pathOriginal;

/** Le refus verbatim de herdr, relevé le 2026-08-21 sur `w0:p24`. */
const REFUS_HERDR =
  '{"error":{"code":"agent_not_found","message":"agent target w1:p1 not found"},"id":"cli:agent:read"}';

/**
 * Un faux herdr FIDÈLE : le registre ignore la cible, et `agent read` échoue comme le vrai —
 * refus sur stdout, code de sortie non nul. `pane read`, lui, rend l'écran sans rien demander
 * au registre, ce qui est précisément pourquoi il existe.
 */
function fauxHerdrSansAgentAuRegistre({ ligneDeBoite = '❯ ' } = {}) {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const ECRAN = ['\\u23fa un travail au-dessus', SEP, ${JSON.stringify(ligneDeBoite)}, SEP, '  auto mode on'].join('\\n');
const REFUS = ${JSON.stringify(REFUS_HERDR)};
if (cmd === 'agent list') { process.stdout.write(JSON.stringify({ id: 'x', result: { agents: [] } }) + '\\n'); }
else if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ id: 'x', error: { code: 'agent_not_found', message: 'nope' } }) + '\\n'); }
else if (cmd === 'pane get') { process.stdout.write(JSON.stringify({ id: 'x', result: { pane: { pane_id: 'w1:p1' } } }) + '\\n'); }
else if (cmd === 'agent read') { process.stdout.write(REFUS + '\\n'); process.exit(1); }
else if (cmd === 'pane read') { process.stdout.write(ECRAN); }
else { process.stdout.write(JSON.stringify({ id: 'x', result: {} }) + '\\n'); }
`;
  const chemin = join(bac, 'herdr');
  writeFileSync(chemin, script);
  chmodSync(chemin, 0o755);
  return journal;
}

const lancer = (args) =>
  spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bac}:${pathOriginal}`, HERDR_SESSIONS_ESSAIS: '/tmp/faux.sock' },
  });

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'erreur-outil-'));
  pathOriginal = process.env.PATH;
});
after(() => rmSync(bac, { recursive: true, force: true }));

test('LE CAS `w0:p24` — un pane que le registre ignore se lit par son PANE, et sa boîte vide se dit VIDE', () => {
  // 🔴 L'ESSAI QUI PORTE LE LOT. Trois sources concordaient que cette boîte était vide —
  // `pane read` rendant `❯` seul, son agent l'écrivant de sa main, et l'écran lui-même — et
  // l'outil répondait `illisible`.
  const journal = fauxHerdrSansAgentAuRegistre({ ligneDeBoite: '❯ ' });
  const r = lancer(['w1:p1']);

  const json = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(
    json.etat,
    'vide',
    'une boîte vide, lisible par son pane, ne peut pas être rendue « illisible » parce que le ' +
      'REGISTRE ignore son agent — lire un écran ne devrait rien demander au registre'
  );
  assert.equal(json.aSoumettre, false);
  assert.equal(r.status, 0, 'une lecture réussie ne coupe pas une chaîne de commandes');

  // Et la preuve du verbe : on a bien demandé `pane read`, jamais `agent read`.
  const appels = readFileSync(journal, 'utf8').trim().split('\n').map(JSON.parse);
  const lectures = appels.filter((a) => a[1] === 'read');
  assert.ok(lectures.length > 0, 'il faut bien avoir lu quelque chose');
  assert.ok(
    lectures.every((a) => a[0] === 'pane'),
    `le verbe doit suivre le fait établi par la résolution — appels vus : ${JSON.stringify(lectures)}`
  );
});

test('UN REFUS D’OUTIL N’EST JAMAIS UN ÉCRAN — même quand il arrive par stdout', async () => {
  // ⚠️ LE DÉFAUT SE TIENT ENTIÈREMENT DANS `lireEcran`, et il survivrait au correctif du verbe :
  // n'importe quel autre refus de herdr — session morte, socket fermée — reviendrait par le
  // même chemin et se ferait passer pour le terminal de quelqu'un.
  const { lireEcran } = await import('../src/appel-herdr.js');
  fauxHerdrSansAgentAuRegistre();

  // ⚠️ LE DOUBLE DOIT ÊTRE ATTEIGNABLE, SINON L'ESSAI PASSE SANS RIEN TOUCHER. Écrit d'abord
  // sans cette ligne, il était VERT du premier coup — parce que `herdr` était introuvable et
  // que `lireEcran` rend `null` dans ce cas aussi. Un vert qui n'a jamais contacté ce qu'il
  // prétend éprouver ne prouve rien, et il est indistinguable d'un vert mérité.
  const pathDuTest = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
  let vu;
  try {
    vu = await lireEcran(['agent', 'read', 'w1:p1', '--format', 'ansi']);
  } finally {
    process.env.PATH = pathDuTest;
  }
  // Le double a bien été appelé — sinon on mesurerait l'absence d'outil, pas son refus.
  const appels = readFileSync(join(bac, 'appels.jsonl'), 'utf8').trim();
  assert.match(appels, /"agent","read"/, 'le double doit avoir été atteint, sinon l’essai ne mesure rien');

  assert.equal(
    vu,
    null,
    'un refus de l’outil doit rendre une lecture ABSENTE — le rendre comme un écran fabrique ' +
      'un verdict sur le terminal d’autrui à partir d’un aveu sur soi'
  );
});

test('CONTRÔLE POSITIF ET NÉGATIF DE LA SONDE DE REFUS — elle doit séparer, pas tout jeter', async () => {
  // ⚠️ UNE SONDE QUI REND LA MÊME VALEUR SUR LES DEUX NE MESURE RIEN. Si elle jetait tout, elle
  // rendrait `illisible` partout — le défaut inverse, et invisible puisqu'il ressemble à de la
  // prudence.
  const { estUnRefusHerdr } = await import('../src/appel-herdr.js');
  assert.equal(estUnRefusHerdr(REFUS_HERDR), true, 'connu-POSITIF : le refus verbatim de herdr');
  assert.equal(
    estUnRefusHerdr('⏺ un écran ordinaire\n────────\n❯ \n────────'),
    false,
    'connu-NÉGATIF : un écran de terminal n’est pas un refus'
  );
  assert.equal(
    estUnRefusHerdr('❯ regarde le champ error du JSON que herdr rend'),
    false,
    'connu-NÉGATIF : un écran qui PARLE d’une erreur n’en est pas une — les agents de ce dépôt ' +
      'affichent constamment ces mots, puisque c’est leur sujet'
  );
  assert.equal(estUnRefusHerdr(''), false, 'connu-NÉGATIF : une sortie vide n’est pas un refus nommé');
});

test('UNE BOÎTE PLEINE RESTE PLEINE — le correctif du verbe ne fait rien passer', () => {
  // ⚠️ LE CHIFFRE QU'ON OUBLIE, ET C'EST LE DANGEREUX : combien de boîtes réellement PLEINES
  // seraient déclarées vides à tort. Élargir la lecture ne doit pas élargir ce qu'on autorise.
  fauxHerdrSansAgentAuRegistre({ ligneDeBoite: '❯ [Pasted text #137 +19 lines]' });
  const json = JSON.parse(lancer(['w1:p1']).stdout.trim().split('\n').pop());
  assert.equal(json.etat, 'collee');
  assert.equal(json.aSoumettre, true, 'on n’écrit pas par-dessus le message de quelqu’un');
});

// livrer-a-un-budget-total.test.js — la durée CUMULÉE de `livrerBrief`, et non plus celle d'un
// appel (T-20260818-0003).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE — UN PLAFOND QUI BORNE CHAQUE APPEL NE BORNE PAS LEUR NOMBRE
//
// Le plafond de 81eb674 (`DELAI_APPEL_MS`, 60 s) empêche un appel herdr de PENDRE. Il ne dit rien
// de combien d'appels on enchaîne : le chemin « brief écrit mais jamais pris » en compte 66
// (2 avant d'écrire, 1 pour écrire, 2 × 16 pour vérifier, 1 touche d'envoi, 2 × 15 pour
// revérifier). Un herdr qui rend la main à 59 s à chaque fois — lent, pas mort — fait donc
// attendre l'appelant plus d'une heure, et aucun plafond ne sonne : chacun est respecté.
//
// C'est exactement « attendre au lieu d'échouer bruyamment ». Aucun essai ne gardait la durée
// cumulée ; celui-ci la garde.
//
// ⚠️ L'HORLOGE EST SIMULÉE, JAMAIS LE VRAI TEMPS. Un banc qui éprouverait une heure en dormant
// une heure ne tournerait jamais — et un banc qui dort réellement laisse des processus derrière
// lui quand on le coupe (leçon du 25/08 : charge 402, faux rouges). Ici chaque double AVANCE une
// horloge ; rien ne dort. Le seul essai en vrai temps est celui du binaire, borné à la seconde
// par un budget minuscule et un `spawnSync` à plafond.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as livraison from '../src/livraison.js';

// Espace de noms plutôt qu'imports nommés : avant le correctif, ces deux noms n'existaient pas, et
// un import nommé aurait fait échouer le FICHIER au chargement — un rouge qui n'éprouve rien.
const { livrerBrief } = livraison;
const CAUSE_BUDGET_EPUISE = livraison.CAUSE_BUDGET_EPUISE ?? 'budget-epuise';
const BUDGET_LIVRAISON_MS = livraison.BUDGET_LIVRAISON_MS;

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(resolve(HERE, '..'), 'bin', 'livrer.js');

const SEP = '─'.repeat(40);
const ecranAvec = (boite) => ['  ▘▘ ▝▝    ~/.gestionnaire/acme', SEP, `❯ ${boite}`.trimEnd(), SEP, '  ⏵⏵ auto mode on'].join('\n');

/** Ce que `livrer.js` passe réellement en production — pas un réglage d'essai. */
const REGLAGES_DU_BIN = { essais: 15, delaiMs: 2000, attenteMs: 20000 };

/** Le plafond d'un appel en production ; le double rend la main JUSTE avant, à chaque fois. */
const PLAFOND_APPEL_MS = 60000;
const LENTEUR_MS = 59000;

/**
 * Un herdr LENT MAIS VIVANT, et une horloge qu'il fait avancer.
 *
 *   boiteInitiale  — ce que la boîte porte avant qu'on écrive
 *   priseJamais    — le brief écrit reste dans la boîte, et la touche d'envoi n'y change rien
 *   lenteurMs      — ce que coûte chaque appel ; plafonné par le `delaiMs` que l'appelant
 *                    passe, comme le vrai `execFile` le tuerait
 *
 * ⚠️ LE DOUBLE RESPECTE LE `delaiMs` QU'ON LUI DONNE — c'est ce que fait le vrai appel (timeout
 * d'`execFile`). Un double qui l'ignorerait ferait rougir un budget qui, en vrai, tiendrait.
 */
function poste({ boiteInitiale = '', priseJamais = true, lenteurMs = LENTEUR_MS } = {}) {
  const horloge = { t: 1_000_000 };
  const journal = [];
  let boite = boiteInitiale;
  let statut = 'idle';
  // Rend VRAI quand l'appel a été COUPÉ par son délai — et alors, comme le vrai `execFile`, il ne
  // rend rien d'exploitable : un écran `null`, un appel en échec.
  const couter = (vers) => {
    const delai = vers?.delaiMs ?? PLAFOND_APPEL_MS;
    horloge.t += Math.min(lenteurMs, delai);
    return delai < lenteurMs;
  };
  return {
    horloge,
    journal,
    maintenant: () => horloge.t,
    dormir: async (ms) => {
      journal.push(['dormir', ms]);
      horloge.t += ms;
    },
    lireEcran: async (cmd, vers) => {
      journal.push(cmd);
      if (couter(vers)) return null;
      return ecranAvec(boite);
    },
    appelHerdr: async (cmd, vers) => {
      journal.push(cmd);
      const coupe = couter(vers);
      const verbe = cmd.slice(0, 2).join(' ');
      if (coupe && verbe !== 'agent prompt' && verbe !== 'agent send-keys') {
        return { ok: false, reponse: null, message: 'délai dépassé' };
      }
      if (verbe === 'agent get') {
        return { ok: true, reponse: { result: { type: 'agent_info', agent: { pane_id: cmd[2], agent_status: statut } } }, message: '' };
      }
      if (verbe === 'agent prompt') {
        if (priseJamais) boite = `${boite}${cmd[3]}`;
        else {
          boite = '';
          statut = 'working';
        }
        return { ok: true, reponse: { result: { type: 'agent_prompted' } }, message: '' };
      }
      if (verbe === 'agent send-keys') {
        if (!priseJamais) boite = '';
        return { ok: true, reponse: { result: { type: 'ok' } }, message: '' };
      }
      return { ok: true, reponse: { result: {} }, message: '' };
    },
  };
}

const sondeMuette = () => ({ etat: 'indeterminee', motif: 'essai' });

test('UN HERDR LENT MAIS VIVANT NE FAIT PLUS ATTENDRE UNE HEURE — le budget total rend un refus NOMMÉ', async () => {
  const p = poste({ priseJamais: true });
  const budgetMs = 120000;
  const debut = p.horloge.t;
  const r = await livrerBrief({
    pane: 'w9:p1',
    texte: 'mon brief',
    ...REGLAGES_DU_BIN,
    appelHerdr: p.appelHerdr,
    lireEcran: p.lireEcran,
    dormir: p.dormir,
    maintenant: p.maintenant,
    sonderActivite: sondeMuette,
    budgetMs,
  });
  const ecoule = p.horloge.t - debut;

  assert.equal(r.ok, false, 'rien n’a été pris : ce ne peut pas être un succès');
  assert.equal(r.cause, CAUSE_BUDGET_EPUISE, `la cause doit être NOMMÉE en champ — reçu ${r.cause}, message : ${r.message}`);
  assert.ok(ecoule <= budgetMs, `livrerBrief doit rendre dans son budget — ${ecoule} ms écoulées pour un budget de ${budgetMs} ms`);
  assert.match(r.message, /budget/i, 'le motif dit que c’est le BUDGET qui a tranché');
  assert.match(r.message, /120 s/, 'et il chiffre le budget dépassé');
  assert.match(r.message, /RIEN n’est confirmé livré/, 'il sépare « pas livré » de « pas confirmé »');
  // Le brief a été ÉCRIT avant que le budget tombe : le taire ferait renvoyer un second brief
  // collé au premier — la fusion que ce module existe pour empêcher.
  assert.ok(r.gestes.includes('livrer'), `le geste d’écriture doit être rendu — gestes : ${JSON.stringify(r.gestes)}`);
  assert.match(r.message, /brief A ÉTÉ ÉCRIT/, 'et dit en toutes lettres qu’il est dans la boîte');
  assert.ok(r.appels > 0, 'il dit combien d’appels ont été tentés');
});

test('LE BUDGET PAR DÉFAUT EST DE 5 MIN — sans option, le pire cas ne dépasse plus cinq minutes', async () => {
  assert.equal(BUDGET_LIVRAISON_MS, 300000, 'le défaut documenté');
  const p = poste({ priseJamais: true });
  const debut = p.horloge.t;
  const r = await livrerBrief({
    pane: 'w9:p1',
    texte: 'mon brief',
    ...REGLAGES_DU_BIN,
    appelHerdr: p.appelHerdr,
    lireEcran: p.lireEcran,
    dormir: p.dormir,
    maintenant: p.maintenant,
    sonderActivite: sondeMuette,
  });
  const ecoule = p.horloge.t - debut;
  assert.equal(r.cause, CAUSE_BUDGET_EPUISE, r.message);
  assert.ok(ecoule <= 300000, `${ecoule} ms pour un défaut de 300 000 ms`);
});

test('UNE BOÎTE OCCUPÉE QUI NE SE LIBÈRE JAMAIS — le refus dit qu’une touche d’envoi est déjà partie', async () => {
  // La délivrance passe par `delivrerLaBoite`, qui a SA propre boucle de lectures : le budget
  // doit la traverser aussi, sans qu'on la réécrive.
  const p = poste({ boiteInitiale: '[Pasted text #33]', priseJamais: true });
  const budgetMs = 300000;
  const debut = p.horloge.t;
  const r = await livrerBrief({
    pane: 'w9:p1',
    texte: 'mon brief',
    ...REGLAGES_DU_BIN,
    pairOccupe: true,
    immobiliteMs: 6000,
    appelHerdr: p.appelHerdr,
    lireEcran: p.lireEcran,
    dormir: p.dormir,
    maintenant: p.maintenant,
    sonderActivite: sondeMuette,
    budgetMs,
  });
  const ecoule = p.horloge.t - debut;
  assert.equal(r.ok, false);
  assert.equal(r.cause, CAUSE_BUDGET_EPUISE, r.message);
  assert.ok(ecoule <= budgetMs, `${ecoule} ms pour un budget de ${budgetMs} ms`);
  assert.ok(r.gestes.includes('soumettre'), `la touche d’envoi est partie avant l’épuisement — ${JSON.stringify(r.gestes)}`);
  assert.ok(!r.gestes.includes('livrer'), 'et le brief, lui, n’a jamais été écrit');
  assert.match(r.message, /touche d’envoi/i);
  assert.equal(r.delivre, false, 'rien n’est confirmé : `delivre` ne peut pas dire le contraire');
});

test('UN APPEL COUPÉ PAR LE BUDGET NE SE LIT PAS COMME UN ÉCRAN ILLISIBLE', async () => {
  // Mesuré sur le binaire à la première écriture de la garde : la lecture d'écran, ramenée aux
  // quelques millisecondes qui restaient, rendait `null` — et le refus disait « boîte
  // illisible, va regarder l'écran ». C'est NOTRE budget qui avait tranché, pas l'écran.
  const p = poste({ priseJamais: true });
  const r = await livrerBrief({
    pane: 'w9:p1',
    texte: 'mon brief',
    ...REGLAGES_DU_BIN,
    appelHerdr: p.appelHerdr,
    lireEcran: p.lireEcran,
    dormir: p.dormir,
    maintenant: p.maintenant,
    sonderActivite: sondeMuette,
    // `agent get` coûte 59 s ; la lecture qui suit n'a plus que 41 s et se fait couper.
    budgetMs: 100000,
  });
  assert.equal(r.cause, CAUSE_BUDGET_EPUISE, `reçu ${r.cause} : ${r.message}`);
  assert.doesNotMatch(r.message, /illisible/);
});

test('CONTRE-ÉPREUVE — un herdr rapide et une boîte qui se libère livrent, verdict DIFFÉRENT', async () => {
  // Sans elle, un budget qui refuserait TOUT passerait les trois essais ci-dessus.
  const p = poste({ priseJamais: false, lenteurMs: 20 });
  const r = await livrerBrief({
    pane: 'w9:p1',
    texte: 'mon brief',
    ...REGLAGES_DU_BIN,
    appelHerdr: p.appelHerdr,
    lireEcran: p.lireEcran,
    dormir: p.dormir,
    maintenant: p.maintenant,
    sonderActivite: sondeMuette,
    budgetMs: 120000,
  });
  assert.equal(r.ok, true, r.message);
  assert.notEqual(r.cause, CAUSE_BUDGET_EPUISE);
  assert.equal(r.gestes, undefined, 'le succès ne porte pas le champ du refus');
});

// ── Le binaire réel : le motif doit franchir la sortie, et le code être non nul.

let bac;
let pathOriginal;
before(() => {
  bac = mkdtempSync(join(tmpdir(), 'smtk-budget-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});
after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});

test('LE BINAIRE SORT EN CODE NON NUL, ET SON JSON NOMME LE BUDGET ÉPUISÉ', () => {
  // ⚠️ VRAI TEMPS, DONC BORNÉ PARTOUT. Le faux herdr dort 250 ms par `get`/`read` via
  // `Atomics.wait` (synchrone, aucun minuteur qui survive), le budget vaut 400 ms, et
  // `spawnSync` tue le tout à 20 s si quoi que ce soit dérape.
  const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
const cmd = args.slice(0, 2).join(' ');
const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const SEP = '─'.repeat(20);
if (cmd === 'agent list') {
  process.stdout.write(JSON.stringify({ result: { agents: [{ agent: 'claude', pane_id: 'w9:p1', name: 'acme', agent_status: 'idle' }] } }));
  process.exit(0);
}
if (cmd === 'agent get') {
  dormir(250);
  process.stdout.write(JSON.stringify({ result: { type: 'agent_info', agent: { pane_id: args[2], name: 'acme', agent_status: 'idle' } } }));
  process.exit(0);
}
if (cmd === 'agent read') {
  dormir(250);
  process.stdout.write(['~/.gestionnaire/acme', SEP, '\\u276f [Pasted text #33]', SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ result: { type: 'ok' } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const r = spawnSync(process.execPath, [BIN, 'w9:p1', '--texte', 'mon brief'], {
    timeout: 20000,
    env: {
      ...process.env,
      LIVRAISON_ESSAIS: '3',
      LIVRAISON_DELAI_MS: '5',
      LIVRAISON_ATTENTE_MS: '50',
      LIVRAISON_IMMOBILITE_MS: '5',
      LIVRAISON_BUDGET_MS: '400',
      HERDR_SESSIONS_ESSAIS: '/tmp/faux-herdr-budget.sock',
    },
  });
  assert.equal(r.signal, null, `le binaire doit sortir DE LUI-MÊME — tué par ${r.signal}`);
  assert.notEqual(r.status, 0, 'un budget épuisé est une PANNE, jamais un succès');
  const stderr = r.stderr.toString();
  const ligne = r.stdout.toString().trim().split('\n').pop();
  const rendu = JSON.parse(ligne);
  assert.equal(rendu.ok, false);
  assert.equal(rendu.cause, CAUSE_BUDGET_EPUISE, `la cause doit franchir le JSON — reçu : ${ligne}`);
  assert.match(stderr, /budget/i, `le motif lisible sur stderr — reçu : ${stderr}`);
  assert.match(stderr, /RIEN n’est confirmé livré/);
});

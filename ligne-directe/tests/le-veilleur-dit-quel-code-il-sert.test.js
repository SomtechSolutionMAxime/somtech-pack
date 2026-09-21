// LE VEILLEUR DIT QUEL CODE IL SERT — ET D'OÙ (T-20260818-0035, + 2 commentaires de batiscan).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT
//
// Le veilleur est un processus PERMANENT : une fois né, rien ne le force à relire son propre
// code. Mesuré : un veilleur a servi du code vieux de 3 jours sans que rien ne le signale, et
// sa relève est manuelle — elle dépend de la mémoire de quelqu'un. Mesuré aussi : un veilleur
// qui tournait depuis un répertoire TEMPORAIRE — un chemin éphémère est un avertissement, pas
// une adresse.
//
// Trois critères du ticket :
//   1. `etat` rend l'IDENTITÉ du code servi (empreinte), pas seulement « vivant » — et D'OÙ ;
//   2. (couvert côté cli/test/releve-veilleur.test.js — la MAJ ne rend jamais un succès muet) ;
//   3. un veilleur servant du code plus ancien que l'installé NOMME l'écart, avec les deux
//      identités.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE BANC EXERCE
//
// Un VRAI `Veilleur`, construit avec un `dossierSrc` JETABLE (jamais le vrai `src/` du
// dépôt — modifier le vrai code pendant la suite de tests serait absurde). `ping` et `etat`
// sont appelés via `traiterGeste`, comme le fait le socket réel — c'est le même chemin que
// `le-geste-vue-repond-par-le-socket.test.js` emprunte pour la vue.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let Veilleur, CHEMIN_JOURNAL;
let bac;

before(async () => {
  // Le registre du veilleur doit lui aussi vivre sous un HOME jetable — jamais
  // ~/.somtech/ligne-directe du poste réel (contrainte absolue du brief).
  process.env.LIGNE_DIRECTE_RACINE = mkdtempSync(join(tmpdir(), 'ld-identite-registre-'));
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ CHEMIN_JOURNAL } = await import('../src/registre.js'));
  bac = mkdtempSync(join(tmpdir(), 'ld-identite-code-'));
});
after(() => rmSync(bac, { recursive: true, force: true }));

/** Un dossier `src` JETABLE, copie minimale — jamais le vrai `ligne-directe/src`. */
function dossierSrcJetable(nom, fichiers) {
  const d = join(bac, nom);
  mkdirSync(d, { recursive: true });
  for (const [f, contenu] of Object.entries(fichiers)) writeFileSync(join(d, f), contenu);
  return d;
}

test('« ping » rend l’identité du code servi : empreinte (12 hex), chemin, date de démarrage', async () => {
  const src = dossierSrcJetable('ping', { 'a.js': 'export const a = 1;\n', 'b.js': 'export const b = 2;\n' });
  const v = new Veilleur({ cheminSocket: join(bac, 'ping.sock'), identite: { equipe: 'T' }, dossierSrc: src });

  const rendu = await v.traiterGeste({ geste: 'ping' });

  assert.ok(rendu.code, 'le ping doit porter `code`, sans rien retirer du reste');
  assert.match(rendu.code.empreinte, /^[0-9a-f]{12}$/, `l’empreinte doit être 12 hex — reçu ${rendu.code.empreinte}`);
  assert.equal(rendu.code.chemin, src, 'le chemin doit être CELUI DONT le code a été mesuré');
  assert.match(rendu.code.demarre_le, /^\d{4}-\d{2}-\d{2}T/, 'demarre_le doit être une date ISO');
  // Rien retiré : le ping garde sa forme d’avant ce lot.
  assert.equal(rendu.ok, true);
  assert.equal(rendu.veilleur, 'vivant');
});

test('« etat » porte code.perime === false quand le disque n’a pas bougé depuis le démarrage', async () => {
  const src = dossierSrcJetable('stable', { 'a.js': 'export const a = 1;\n' });
  const v = new Veilleur({ cheminSocket: join(bac, 'stable.sock'), identite: { equipe: 'T' }, dossierSrc: src });

  const etat = v.etat();

  assert.equal(etat.code.perime, false, `code inchangé : perime doit être false — reçu ${JSON.stringify(etat.code)}`);
  assert.equal(etat.code.motif, null, 'rien à nommer quand c’est à jour');
});

test('« etat » NOMME L’ÉCART, avec les deux empreintes, quand le disque a changé après le démarrage', async () => {
  const src = dossierSrcJetable('bouge', { 'a.js': 'export const a = 1;\n' });
  const v = new Veilleur({ cheminSocket: join(bac, 'bouge.sock'), identite: { equipe: 'T' }, dossierSrc: src });
  const empreinteServie = v.code.empreinte;

  // ⚠️ LE DISQUE CHANGE APRÈS le démarrage du veilleur — son identité DE DÉPART, `this.code`,
  // ne bouge pas toute seule : c'est exactement la situation mesurée (le veilleur continue de
  // SERVIR l'ancien pendant que le poste a du neuf).
  writeFileSync(join(src, 'a.js'), 'export const a = 2; // changé après le démarrage\n');

  const etat = v.etat();

  assert.equal(etat.code.perime, true, 'le code sur disque a changé : perime doit être true');
  assert.notEqual(etat.code.sur_disque.empreinte, empreinteServie, 'la mesure sur disque doit refléter le NOUVEAU contenu, recalculée à cet appel');
  assert.ok(etat.code.motif.includes(empreinteServie), `le motif doit nommer l’empreinte SERVIE — reçu : ${etat.code.motif}`);
  assert.ok(
    etat.code.motif.includes(etat.code.sur_disque.empreinte),
    `le motif doit nommer l’empreinte INSTALLÉE — reçu : ${etat.code.motif}`
  );

  // ⚠️ RECALCULÉ À CHAQUE APPEL, PAS MIS EN CACHE (mutation m3 du brief) : un second appel
  // après un second changement doit à nouveau bouger — sinon `etat` figerait sa première
  // mesure du disque pour toujours.
  writeFileSync(join(src, 'a.js'), 'export const a = 3; // changé une seconde fois\n');
  const etat2 = v.etat();
  assert.notEqual(
    etat2.code.sur_disque.empreinte,
    etat.code.sur_disque.empreinte,
    'un second appel doit remesurer le disque, pas resservir la mesure du premier appel'
  );
});

test('le chien de garde journalise le code périmé UNE SEULE FOIS, jamais à chaque tour', async () => {
  const src = dossierSrcJetable('surveille', { 'a.js': 'export const a = 1;\n' });
  const v = new Veilleur({ cheminSocket: join(bac, 'surveille.sock'), identite: { equipe: 'T' }, dossierSrc: src });
  // Écoute déclarée VIVANTE : sans ça, le chien de garde entrerait aussi dans la branche de
  // reconnexion Slack (hors sujet ici, et cloisonnée par ailleurs) à chaque tour.
  v.ws = { readyState: 1 };

  writeFileSync(join(src, 'a.js'), 'export const a = 2; // périmé pour ce banc\n');

  const minuteur = v.surveiller(10);
  // Plusieurs tours à cadence courte : si le drapeau ne tenait pas, chaque tour ajouterait
  // une ligne de plus au journal.
  await new Promise((r) => setTimeout(r, 90));
  clearInterval(minuteur);

  assert.ok(existsSync(CHEMIN_JOURNAL), 'le journal doit exister — le chien de garde doit avoir écrit');
  const journal = readFileSync(CHEMIN_JOURNAL, 'utf8');
  const occurrences = journal.split('code périmé').length - 1;
  assert.equal(occurrences, 1, `le chien de garde doit journaliser UNE SEULE FOIS — trouvé ${occurrences} fois dans :\n${journal}`);
  assert.match(journal, /Relève : ligne-directe relever/, 'le journal doit dire le geste de relève à qui le lit');
});

test('LE MESSAGE DE DÉMARRAGE nomme l’empreinte, la date et le chemin — et prévient si le chemin est éphémère', async () => {
  // `Veilleur.demarrer` fait naître un VRAI veilleur (Slack compris) — hors de portée d’un
  // banc sous cloison. On exerce donc directement `messageDemarrage`, LA fonction que
  // `demarrer()` appelle pour composer ce qu'il journalise : un seul point de vérité entre
  // ce banc et la production, pas une reconstitution à côté qui pourrait diverger.
  const { messageDemarrage } = await import('../src/veilleur.js');

  const normal = messageDemarrage({
    equipe: 'T',
    ouvertes: 0,
    code: { empreinte: 'abc123def456', date: '2026-08-20T00:00:00.000Z', chemin: '/Users/x/.somtech/ligne-directe/src', ephemere: false },
  });
  assert.ok(normal.some((l) => l.includes('abc123def456')), 'le message doit porter l’empreinte');
  assert.ok(normal.some((l) => l.includes('/Users/x/.somtech/ligne-directe/src')), 'le message doit porter le chemin (D’OÙ il s’exécute)');
  assert.ok(!normal.some((l) => l.includes('éphémère')), 'un chemin normal ne doit pas porter l’avertissement');

  const ephemere = messageDemarrage({
    equipe: 'T',
    ouvertes: 0,
    code: { empreinte: 'abc123def456', date: '2026-08-20T00:00:00.000Z', chemin: '/tmp/xyz/ligne-directe/src', ephemere: true },
  });
  assert.ok(ephemere.some((l) => l.includes('éphémère')), 'un chemin éphémère doit être signalé');
});

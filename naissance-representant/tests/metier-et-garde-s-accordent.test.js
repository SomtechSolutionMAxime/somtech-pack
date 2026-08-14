// LE MÉTIER ET LE GARDE DISENT-ILS LA MÊME CHOSE ? (T-20260814-0033)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST LE SEUL DE SON GENRE
//
// Deux lots se font face, et chacun est vert de son côté :
//
//   • `.claude/templates/gestionnaire-client/CLAUDE.md` PRESCRIT une séquence d'ouverture —
//     c'est ce qu'un gestionnaire lit et recopie à sa naissance. Son harnais (côté `cli/`)
//     éprouve ce que le TEXTE enseigne ;
//   • `naissance-representant/src/garde.js` DÉCIDE ce qui passe — c'est ce qu'un
//     gestionnaire subit. Son harnais éprouve ce que la GARDE laisse passer.
//
// Aucun des deux ne voit l'autre. Les deux peuvent donc être verts pendant que le métier
// prescrit, mot pour mot, une commande que le garde refuse — et c'est arrivé :
//
//     herdr pane current                    # ton pane
//     $LD etat                              # une ligne est-elle déjà ouverte sur ce pane ?
//
// Le commentaire shell avait été appris au garde par le chemin des OUVERTURES et par lui
// seul ; les segments communs, eux, étaient éprouvés sur le texte brut. Un gestionnaire qui
// recopiait son propre métier était bloqué au premier geste, sans que rien ne lui dise
// pourquoi — et sans qu'aucune des deux suites ne rougisse.
//
// CE CONTRÔLE EST LE PONT. Il lit le gabarit RÉEL, en extrait la séquence RÉELLE, et la
// présente au garde RÉEL. Il ne cherche aucun mot : il éprouve l'ACCORD des deux lots, qui
// est précisément ce que ni l'un ni l'autre ne peut prouver seul.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { segmentsHorsSequence, decider, naturesOuvertesDuPane } from '../src/garde.js';
// LES FONCTIONS QUE LA COMMANDE APPELLE — la résolution d'un « --a » et le nommage d'un canal.
// Les réécrire ici ne prouverait que l'accord de cet essai avec lui-même.
import { ligneDuPane } from '../../ligne-directe/src/registre.js';
import { nomDeCanal, libelleDeCanal } from '../../ligne-directe/src/nommage.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const METIER = join(REPO, '.claude', 'templates', 'gestionnaire-client', 'CLAUDE.md');

/**
 * La séquence d'ouverture telle que le métier l'écrit, ses emplacements substitués comme un
 * agent les substituerait.
 *
 * ⚠️ ON PREND LE PREMIER BLOC DU DOCUMENT, jamais un bloc choisi par son contenu : chercher
 * « celui qui contient `ouvrir` » rendrait ce contrôle vert le jour où la séquence
 * disparaîtrait du métier, puisqu'il irait la chercher ailleurs.
 */
function sequenceDuMetier() {
  const texte = readFileSync(METIER, 'utf8');
  const bloc = texte.match(/```bash\n([\s\S]*?)```/);
  assert.ok(bloc, 'le métier doit porter une séquence d’ouverture en bloc shell');
  return bloc[1]
    .replace(/<le client, en minuscules>/g, 'acme')
    .replace(/<ton-pane>/g, 'w1:p1')
    .replace(/<le client>/g, 'acme')
    .replace(/<le titre donné par CONTEXTE\.md>/g, 'Espace Acme');
}

test('CE QUE LE MÉTIER PRESCRIT, LE GARDE LE LAISSE PASSER — mot pour mot', () => {
  const sequence = sequenceDuMetier();
  const refuses = segmentsHorsSequence(sequence, 'representant');
  assert.deepEqual(
    refuses,
    [],
    `le métier prescrit des gestes que le garde refuse :\n  ${refuses.join('\n  ')}\n` +
      `Un gestionnaire qui recopie son propre métier serait bloqué au premier geste.`
  );
  assert.equal(
    decider({ toolName: 'Bash', toolInput: { command: sequence }, naturesOuvertes: [], role: 'representant' })
      .permissionDecision,
    'allow',
    'la séquence entière, en un seul appel, doit être permise avant qu’aucune ligne ne soit ouverte'
  );
});

test('ET ELLE OUVRE LES DEUX LIGNES QUE LE GARDE EXIGE — sinon le pane ne se relâche jamais', () => {
  // L'accord ne suffit pas : une séquence permise qui n'ouvrirait qu'UNE ligne laisserait le
  // pane fermé pour toujours, et l'agent lirait un refus en ayant fait exactement ce que son
  // métier lui disait. C'est le blocage dur que ce lot ferme, éprouvé par le fait.
  const sequence = sequenceDuMetier();
  const ouvertes = [];
  for (const segment of sequence.split('\n')) {
    const cle = segmentOuvre(segment);
    if (cle) ouvertes.push(cle);
  }
  assert.deepEqual(
    [...ouvertes].sort(),
    ['client', 'interne'],
    `la séquence du métier ouvre ${ouvertes.length} ligne(s) — le garde en exige deux, ` +
      `celle du client et celle du dirigeant`
  );

  // Et une fois les deux ouvertes, le pane se relâche pour de bon.
  const etat = {
    ouvertes: [
      { pane: 'w1:p1', chantier: 'acme', nature: 'client' },
      { pane: 'w1:p1', chantier: 'dirigeant', nature: 'interne' },
    ],
  };
  assert.equal(
    decider({
      toolName: 'mcp__servicedesk__demands',
      toolInput: { action: 'list' },
      naturesOuvertes: naturesOuvertesDuPane(etat, 'w1:p1'),
      role: 'representant',
    }).permissionDecision,
    'allow',
    'après la séquence du métier, le gestionnaire doit pouvoir travailler'
  );
});

test('CHAQUE « --a » DU MÉTIER DÉSIGNE UNE LIGNE QUE LE MÉTIER OUVRE — sinon chaque remontée est refusée', () => {
  // ⚠️ LE PONT S'ARRÊTAIT À L'OUVERTURE (relevé en revue de passe 1). Il prouvait que la
  // séquence passe le garde ; il ne disait RIEN de l'usage. Or les deux moitiés du métier
  // peuvent diverger sans qu'aucune suite ne rougisse : si le chantier ouvert devenait
  // `patron` pendant que les remontées gardent `--a dirigeant`, la séquence resterait permise,
  // le gestionnaire naîtrait avec ses deux lignes — et CHAQUE remontée serait refusée, faute
  // de ligne désignée. Il est tenu de remonter quatre choses ; il n'en remonterait aucune.
  //
  // ON RÉSOUT AVEC `ligneDuPane`, LA FONCTION QUE LA COMMANDE APPELLE (T-20260813-0078).
  // Réécrire ici la règle de désignation ne prouverait que l'accord de l'essai avec lui-même —
  // c'est le piège que ce dépôt nomme, et le lot d'à côté l'a déjà payé.
  const texte = readFileSync(METIER, 'utf8');
  const substituer = (s) => s.replace(/<le client>/g, 'acme').replace(/<le titre donné par CONTEXTE\.md>/g, 'Espace Acme');

  // Les lignes que la séquence du métier ferait naître, telles que `etat()` les rendrait.
  const ouvertures = [...texte.matchAll(/\$LD ouvrir ([^\n]*)/g)].map((m) => substituer(m[1]));
  assert.equal(ouvertures.length, 2, 'le métier doit ouvrir deux lignes');
  const ouvertes = ouvertures.map((args) => {
    const chantier = args.split(/\s+/)[0];
    const titre = args.match(/--titre\s+"([^"]*)"/);
    return {
      chantier,
      // Le nom du canal vient du TITRE, par les fonctions du module — jamais deviné ici.
      canal: nomDeCanal(libelleDeCanal(chantier, titre && titre[1])),
      pane: 'w1:p1',
    };
  });

  // Chaque désignation que le métier enseigne doit tomber sur une ligne, et UNE SEULE.
  const designations = [...texte.matchAll(/--a\s+(<[^>]*>|\S+)/g)].map((m) => substituer(m[1]));
  assert.ok(designations.length >= 2, `le métier doit enseigner l’usage des DEUX lignes (${designations.length} désignation·s)`);
  for (const nom of designations) {
    const { ligne, refus } = ligneDuPane(ouvertes, 'w1:p1', nom);
    assert.ok(
      ligne,
      `« --a ${nom} » ne désigne aucune ligne que le métier ouvre (${refus && refus.motif}) — ` +
        `les lignes ouvertes sont : ${ouvertes.map((l) => l.chantier).join(', ')}`
    );
  }

  // ET LES DEUX SONT ENSEIGNÉES, pas seulement l'une. Un métier qui n'apprendrait à viser que
  // le client laisserait la ligne du dirigeant ouverte et jamais employée — le manque
  // d'origine, avec une ligne de plus pour faire illusion.
  const visees = new Set(
    designations.map((nom) => ligneDuPane(ouvertes, 'w1:p1', nom).ligne?.chantier).filter(Boolean)
  );
  assert.deepEqual(
    [...visees].sort(),
    ouvertes.map((l) => l.chantier).sort(),
    'le métier doit enseigner à viser CHACUNE de ses deux lignes'
  );
});

/**
 * La NATURE de la ligne qu'un segment ouvre, ou `null`.
 *
 * On la déduit du segment comme le veilleur la déduira — `--nature client` ou rien —, plutôt
 * que de demander au garde quelle clé il a reconnue : ce qui compte ici est ce que le métier
 * fera OUVRIR, pas le nom interne que le garde lui donne.
 */
function segmentOuvre(segment) {
  if (segmentsHorsSequence(segment, 'representant').length > 0) return null;
  if (!/\bouvrir\b/.test(segment)) return null;
  return /--nature client/.test(segment) ? 'client' : 'interne';
}

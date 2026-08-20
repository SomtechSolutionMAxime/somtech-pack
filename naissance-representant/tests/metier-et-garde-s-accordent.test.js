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
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { segmentsHorsSequence, decider, naturesOuvertesDuPane } from '../src/garde.js';
// LES FONCTIONS QUE LA COMMANDE APPELLE — la résolution d'un « --a » et le nommage d'un canal.
// Les réécrire ici ne prouverait que l'accord de cet essai avec lui-même.
import { ligneDuPane } from '../../ligne-directe/src/registre.js';
import { nomDeCanal, libelleDeCanal } from '../../ligne-directe/src/nommage.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/**
 * Le métier ENTIER d'un rôle : son socle permanent, puis ses chapitres.
 *
 * ⚠️ Depuis que le gabarit est RENDU (P-20260820-0001), le métier n'est plus UN
 * fichier : `CLAUDE.md` porte le socle, et `metier/chapitres/*.md` le reste.
 * Un contrôle qui ne lirait que le socle jugerait 850 mots là où le métier en
 * fait 25 000 : il passerait au vert sans rien garder.
 */
/** Un chapitre nommé du métier rendu d'un rôle. */
function chapitre(role, nom) {
  const f = join(REPO, '.claude', 'templates', role, 'metier', 'chapitres', `${nom}.md`);
  assert.ok(existsSync(f), `le métier de « ${role} » doit porter un chapitre « ${nom} »`);
  return readFileSync(f, 'utf8');
}

function metierEntier(role) {
  const dir = join(REPO, '.claude', 'templates', role);
  const socle = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  const chap = join(dir, 'metier', 'chapitres');
  if (!existsSync(chap)) return socle;
  return [socle, ...readdirSync(chap).sort().map((f) => readFileSync(join(chap, f), 'utf8'))].join('\n\n');
}

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
  // ⚠️ Depuis que le métier est RENDU (P-20260820-0001), il tient dans un socle
  // et des chapitres. « Le premier bloc du document » ne désigne plus la séquence
  // d'ouverture : les chapitres se lisent dans l'ordre alphabétique, et le premier
  // bloc rencontré vient d'ailleurs.
  //
  // On lit donc le CHAPITRE qui porte la joignabilité, puis SON premier bloc.
  // L'intention du contrôle est intacte — on ne choisit toujours pas un bloc par
  // son contenu : si la séquence disparaît de ce chapitre, ce contrôle rougit.
  const texte = chapitre('gestionnaire-client', 'joignabilite');
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
  const texte = metierEntier('gestionnaire-client');
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

  // ⚠️ IL PORTE UNE TROISIÈME LIGNE QU'IL N'OUVRE PAS (T-20260814-0093) — celle du chantier,
  // qu'un orchestrateur lui PARTAGE en le nommant à son ouverture. Ce contrôle ne peut donc plus
  // exiger que toute désignation tombe sur une ligne que le métier OUVRE : ce serait refuser au
  // gestionnaire d'enseigner l'usage de la ligne qu'on lui donne. Ce qu'il exige toujours, et
  // qui est le vrai risque : aucune désignation ne doit rester SANS destinataire, et aucune ne
  // doit devenir AMBIGUË une fois la ligne du chantier présente — c'est ce qui enverrait la
  // question du client dans le canal du chantier, ou l'inverse.
  const designations = [...texte.matchAll(/--a\s+(<[^>]*>|\S+)/g)].map((m) => substituer(m[1]));
  assert.ok(designations.length >= 2, `le métier doit enseigner l’usage de ses lignes (${designations.length} désignation·s)`);

  const propres = new Set(ouvertes.map((l) => l.chantier));
  const partagees = [...new Set(designations.filter((nom) => !ligneDuPane(ouvertes, 'w1:p1', nom).ligne))];
  for (const nom of partagees) {
    // On la présente comme le veilleur l'inscrirait : portée par l'orchestrateur, partagée avec
    // le pane du gestionnaire. C'est `panesDeLigne` — la fonction que la commande appelle — qui
    // décide si elle est atteignable, jamais une règle réécrite ici.
    const avecChantier = [...ouvertes, { chantier: nom, canal: nom, pane: 'w7:pO', pair: { pane: 'w1:p1' } }];
    const { ligne, refus } = ligneDuPane(avecChantier, 'w1:p1', nom);
    assert.ok(
      ligne,
      `« --a ${nom} » n’atteint rien, même sur une ligne de chantier partagée (${refus && refus.motif})`
    );
    assert.equal(ligne.chantier, nom, `« --a ${nom} » doit désigner la ligne du chantier, pas une autre`);
    // Et l'inverse : la présence du chantier ne doit voler AUCUNE des deux lignes propres.
    for (const propre of propres) {
      assert.equal(
        ligneDuPane(avecChantier, 'w1:p1', propre).ligne?.chantier,
        propre,
        `avec la ligne « ${nom} » ouverte, « --a ${propre} » cesse d’atteindre la sienne`
      );
    }
  }

  // ET LES DEUX LIGNES PROPRES SONT ENSEIGNÉES, pas seulement l'une. Un métier qui n'apprendrait
  // à viser que le client laisserait la ligne du dirigeant ouverte et jamais employée — le
  // manque d'origine, avec une ligne de plus pour faire illusion.
  const visees = new Set(
    designations.map((nom) => ligneDuPane(ouvertes, 'w1:p1', nom).ligne?.chantier).filter(Boolean)
  );
  assert.deepEqual([...visees].sort(), [...propres].sort(), 'le métier doit enseigner à viser CHACUNE de ses deux lignes');
});

test('LA SÉQUENCE DE L’ORCHESTRATEUR MANDATÉ PASSE SON GARDE — mot pour mot (T-20260814-0093)', () => {
  // Le même pont, pour l'autre rôle. Son métier lui dit désormais de nommer son gestionnaire à
  // l'ouverture ; si le garde ne connaissait pas ce drapeau, il refuserait la séquence QUE LE
  // GABARIT DICTE — l'agent bloqué au premier geste, exactement T-20260814-0033. Aucune des deux
  // suites d'origine ne peut le voir : l'une lit le texte, l'autre lit la décision.
  const metier = metierEntier('orchestrateur');
  const ouvertures = [...metier.matchAll(/```bash\n([\s\S]*?)```/g)]
    .map((m) => m[1])
    .filter((b) => /ligne-directe\.js" ouvrir/.test(b))
    .map((b) =>
      b
        .replace(/<le chantier en deux mots>/g, 'Refonte du devis')
        .replace(/<son-nom-d-agent>/g, 'acme-gestionnaire')
        .replace(/\\\n\s*/g, ' ')
    );
  assert.ok(ouvertures.length >= 1, 'le métier de l’orchestrateur doit porter sa séquence d’ouverture');
  for (const sequence of ouvertures) {
    assert.deepEqual(
      segmentsHorsSequence(sequence, 'orchestrateur'),
      [],
      `le métier de l’orchestrateur prescrit un geste que son garde refuse :\n  ${sequence}`
    );
  }
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


// ═══════════════════════════════════════════════════════════════════════════════════════
// LE MÉTIER ÉCRIT ET LA GARDE DE NOMMAGE DISENT-ILS LA MÊME CHOSE ? — E-20260818-0017
//
// `R3` disait littéralement l'inverse de la règle tranchée : « un agent … porte le code de ce
// mandat. Rien d'autre », avec `revue-pr180` pour contre-exemple — et un nom de rivière est
// exactement ça, au regard de ce texte. `matapedia` a tranché C1 et A NOMMÉ LA DETTE en
// tranchant : tant que le gabarit n'était pas amendé À LA SOURCE, un orchestrateur qui le
// lisait avait raison de s'y fier.
//
// ⚠️ CES DEUX ESSAIS GARDENT LA FONCTION, PAS UNE TOURNURE. Chercher « rivière » dans le texte
// prouverait qu'un mot est là ; une réécriture ordonnée le remplacerait par un synonyme et la
// garde tomberait au vert sur un métier vidé. On fait donc JUGER LES EXEMPLES DU TEXTE PAR LE
// CODE : c'est le seul accord qui compte, et il survit à n'importe quelle rédaction.

import { estUneRiviere, jugerNomDOrchestrateur } from '../../ligne-directe/src/nom-de-riviere.js';

/** Les exemples que le métier donne, tels qu'il les écrit : « - ✅ `nom` » / « - ❌ `nom` ». */
function exemplesDuMetier(marque) {
  const metier = metierEntier('orchestrateur');
  const motif = new RegExp('^- ' + marque + ' `([^`]+)`', 'gmu');
  return [...metier.matchAll(motif)].map((m) => m[1].trim());
}

test('le métier ENSEIGNE la règle de la rivière — au moins un exemple positif que la garde accepte', () => {
  const acceptes = exemplesDuMetier('✅').filter((n) => estUneRiviere(n));
  assert.ok(
    acceptes.length >= 1,
    'aucun exemple ✅ du métier n’est une rivière : le texte opposable n’enseigne plus la règle que le code applique, ' +
      'et un orchestrateur qui le lit aura raison de croire qu’il porte le code de son mandat',
  );
});

test('AUCUN contre-exemple du métier n’est accepté par la garde — sinon le texte refuse ce que le code laisse passer', () => {
  // Le sens qui compte : si le métier écrivait « ❌ matapedia » pendant que la garde l'accepte,
  // le lecteur et la commande se contrediraient — et c'est le lecteur qui perdrait, puisqu'il
  // ne peut pas voir le code.
  for (const nom of exemplesDuMetier('❌')) {
    assert.equal(
      jugerNomDOrchestrateur(nom).conforme,
      false,
      `le métier donne « ${nom} » en contre-exemple, mais la garde l’accepterait pour un orchestrateur`,
    );
  }
});

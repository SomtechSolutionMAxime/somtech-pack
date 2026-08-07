// La compétence d'installation du représentant client — sa DISTRIBUTION, sa CONFORMITÉ, et
// ce qu'elle NE promet plus depuis E-20260807-0002.
//
// E-20260807-0002 a remplacé le contenu de cette compétence : elle ne « devient » plus le
// représentant d'un client (ce métier vit désormais dans le gabarit `CLAUDE.md`, couvert par
// representant-gabarit.test.js), elle PRÉPARE SON LIEU et s'arrête. La plupart des anciennes
// assertions de ce fichier portaient sur un contenu qui a quitté cette compétence — les
// remplacer une à une aurait gardé des tests qui ne prouvent plus rien ; ce fichier est donc
// reconstruit pour la nouvelle promesse.
//
// Trois familles :
//
//   1. **Distribution** — inchangée dans son principe (EA-GBL-003) : la compétence doit
//      arriver là où on l'invoque, sous la forme exacte de sa source.
//
//   2. **Conformité (EF-AGT-002)** — chaque geste et chaque option de ligne qu'elle enseigne
//      doit exister RÉELLEMENT dans la commande. Le pack s'est déjà fait avoir : une
//      compétence enseignait `herdr wait output …`, qui n'existe pas.
//
//   3. **Ce que la nouvelle promesse interdit** — la compétence ne doit plus enseigner les
//      gestes qui appartenaient à l'ANCIENNE promesse (ouvrir une ligne, accueillir une
//      demande, exécuter un chantier) : leur présence signalerait un lot mal terminé, à
//      moitié remplacé.
//
// Le comportement RÉEL de refus — « rien n'a été créé » — n'est PAS reprouvé ici : il l'est
// au niveau du code, par mutation, dans ligne-directe/tests/representant-lieu.test.js. Ce
// fichier-ci ne prouve que la conformité du TEXTE à ce code, jamais son comportement — le
// texte ne peut pas exécuter quoi que ce soit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installGlobalSkills } from '../src/globalskills.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const REPO = resolve(CLI_DIR, '..');
const BUILD = join(CLI_DIR, 'scripts', 'build-payload.mjs');

const NOM = 'gestionnaire-client';
const CHEMIN = join('.claude', 'skills', NOM, 'SKILL.md');
const SOURCE = join(REPO, CHEMIN);

const skill = () => readFileSync(SOURCE, 'utf8');

// ═══════════════════════════════ 1. la chaîne de distribution

test('distribution : la compétence existe dans les sources du dépôt', () => {
  assert.ok(existsSync(SOURCE), `${CHEMIN} est absent des sources`);
});

test('distribution : elle atterrit dans les compétences globales d’un poste vierge', () => {
  const skillsDir = mkdtempSync(join(tmpdir(), 'smtk-gc-'));
  const r = installGlobalSkills({ payloadRoot: REPO, skillsDir });

  assert.ok(r.skills.includes(NOM), `${NOM} absent des compétences installées`);
  assert.ok(existsSync(join(skillsDir, NOM, 'SKILL.md')), 'SKILL.md non copié sur le poste');
  assert.equal(
    readFileSync(join(skillsDir, NOM, 'SKILL.md'), 'utf8'),
    skill(),
    'la version installée diverge de la source'
  );
});

test('distribution : le paquet publié l’embarque, CONSTRUIT depuis la source (RA-DIS-002)', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-gc-payload-'));
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: out }, stdio: 'pipe' });

  assert.ok(existsSync(join(out, CHEMIN)), `${CHEMIN} absent du paquet publié`);
  assert.equal(readFileSync(join(out, CHEMIN), 'utf8'), skill(), 'la version publiée diverge de la source (drift)');
});

test('distribution : son en-tête est bien formé — sinon elle est installée mais inerte', () => {
  const texte = skill();
  const entete = texte.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(entete, 'aucun en-tête lisible en tête de fichier');

  const nom = entete[1].match(/^name:\s*(\S+)\s*$/m);
  assert.ok(nom, 'l’en-tête ne déclare pas de nom');
  assert.equal(nom[1], NOM, 'le nom déclaré doit être celui du dossier, sinon l’invocation ne trouve rien');

  const description = entete[1].match(/^description:\s*(.+)$/m);
  assert.ok(description, 'l’en-tête ne déclare pas de description');
  assert.ok(description[1].trim().length > 120, 'une description trop courte ne déclenche jamais la compétence');
});

// ═══════════════════════════════ 2. les gestes enseignés existent vraiment (EF-AGT-002)

/** Les gestes et options que la commande de ligne accepte réellement, lus dans sa source. */
function outilDeLigne() {
  const src = readFileSync(join(REPO, 'ligne-directe', 'bin', 'ligne-directe.js'), 'utf8');
  const gestes = new Set();
  for (const m of src.matchAll(/geste === '([a-zà-ÿ-]+)'/g)) gestes.add(m[1]);
  const options = new Set();
  for (const m of src.matchAll(/'(--[a-zà-ÿ-]+)'/g)) options.add(m[1]);
  return { gestes, options };
}

test('conformité : chaque geste de ligne enseigné existe dans la commande', () => {
  const { gestes } = outilDeLigne();
  assert.ok(gestes.size >= 5, 'les gestes de la commande n’ont pas été relevés — le test ne prouverait rien');

  const cites = [...skill().matchAll(/\$LD\s+([a-zà-ÿ-]+)/g)].map((m) => m[1]);
  assert.ok(cites.length > 0, 'la compétence doit montrer au moins un geste de ligne');
  for (const geste of cites) {
    assert.ok(gestes.has(geste), `la compétence enseigne « ${geste} », que la commande ne connaît pas`);
  }
});

/**
 * Les options citées sur une ligne d'invocation `$LD …` — jamais celles d'un autre outil
 * (`git`, `gh`) qui partage la même page. Sans ce filtrage, `gh pr create --draft --title`
 * ferait accuser la compétence d'inventer des options de LIGNE DIRECTE qu'elle n'enseigne
 * pas — un faux positif qui ne prouverait rien.
 */
function optionsCitees(texte) {
  const invocations = [...texte.matchAll(/\$LD\s+[a-zà-ÿ-]+[^\n]*(?:\\\n[^\n]*)*/g)].map((m) => m[0]);
  const opts = new Set();
  for (const inv of invocations) {
    for (const m of inv.matchAll(/--[a-zà-ÿ-]+/g)) opts.add(m[0]);
  }
  return opts;
}

test('conformité : chaque option de ligne enseignée existe dans la commande', () => {
  const { options } = outilDeLigne();
  const cites = optionsCitees(skill());
  assert.ok(cites.size > 0, 'la compétence doit montrer au moins une option de ligne');
  for (const option of cites) {
    assert.ok(options.has(option), `la compétence enseigne « ${option} », que la commande ne connaît pas`);
  }
});

test('conformité : le geste « representant » de la ligne est bien celui que la compétence enseigne', () => {
  // EF-AGT-002 appliqué à SA raison d'être : cette compétence tient sur un seul geste
  // nouveau. S'il manque ou s'il est mal orthographié, la compétence entière est inerte,
  // sans qu'aucune relecture ne le remarque — le geste n'existe simplement jamais.
  const { gestes } = outilDeLigne();
  assert.ok(gestes.has('representant'), 'la commande doit connaître le geste « representant »');
  assert.match(skill(), /\$LD representant\s+<client>\s+--canal/, 'la compétence doit enseigner ce geste exact');
});

// ═══════════════════════════════ 3. ce que la NOUVELLE promesse interdit

test('NÉGATIF : elle n’ouvre plus de ligne elle-même (HS — ce geste appartenait à l’ancienne promesse)', () => {
  // Avant E-20260807-0002, la compétence ouvrait sa propre ligne (`$LD ouvrir --nature
  // client --titre …`). Le nouveau lot ne fait que VÉRIFIER la joignabilité, jamais ouvrir :
  // sa survivance signalerait un remplacement à moitié fait, deux promesses mélangées.
  const texte = skill();
  assert.ok(!/\$LD ouvrir/.test(texte), 'la compétence ne doit plus ouvrir de ligne — elle ne fait que la vérifier');
  assert.ok(!texte.includes('--nature client'), '« --nature client » appartenait au geste d’ouverture, disparu de ce lot');
});

test('NÉGATIF : elle ne fusionne jamais, ne déploie jamais, ne publie jamais (HS-REL-001)', () => {
  // Commit et push de la SCAFFOLDING QU'ELLE VIENT DE POSER sont légitimes ici — contrairement
  // à l'ancienne promesse, celle-ci verse elle-même son propre lieu. Ce qui reste hors-scope,
  // c'est tout ce qui dépasse cette scaffolding : fusionner, déployer, publier, ou toucher au
  // travail du client au-delà de `.gestionnaire/`.
  const texte = skill();
  const interdits = ['npm publish', '/pousse-staging', 'supabase db', 'gh pr merge', 'git push --force'];
  for (const geste of interdits) {
    for (const bloc of texte.matchAll(/```bash\n([\s\S]*?)```/g)) {
      assert.ok(!bloc[1].includes(geste), `la compétence enseigne « ${geste} » : elle ne fusionne ni ne déploie`);
    }
  }
});

test('NÉGATIF : elle ne tente jamais de rejoindre un canal elle-même — le geste appartient à un humain', () => {
  // Mesuré et clos (constat repris du cadrage) : un robot ne rejoint pas un canal privé, et
  // le droit de rejoindre ne couvre que les canaux publics. La compétence ne doit donc
  // jamais enseigner `conversations.join`, ni suggérer de demander ce droit.
  const texte = skill();
  assert.ok(!texte.includes('conversations.join'), 'la compétence ne doit jamais enseigner à rejoindre un canal');
  assert.ok(!/channels:join/.test(texte), 'la compétence ne doit jamais suggérer de demander ce droit — il ne réglerait rien');
});

// ═══════════════════════════════ 4. ce que la promesse ACTUELLE doit tenir

test('la compétence dit refuser AVANT de créer quoi que ce soit', () => {
  const texte = skill();
  assert.match(texte, /refuse/i, 'le refus doit être nommé');
  // Position, pas seulement présence : le principe de vérification doit apparaître dans les
  // tout premiers paragraphes de la compétence, pas noyé après la procédure de création —
  // sinon un lecteur pressé code d'abord et vérifie ensuite.
  const texte_normalise = texte.toLowerCase();
  const idxPrincipe = texte_normalise.indexOf('elle ne crée rien tant qu');
  const idxGeste = texte_normalise.indexOf('## le geste');
  assert.ok(idxPrincipe !== -1, 'le principe « rien tant que non vérifié » doit être écrit explicitement');
  assert.ok(idxPrincipe < idxGeste, 'le principe doit précéder la procédure, pas la suivre');
});

test('la compétence distingue les deux motifs de refus et le geste humain qui lève chacun', () => {
  const texte = skill();
  assert.match(texte, /absent/, 'le motif « canal absent » doit être nommé');
  assert.match(texte, /non_membre/, 'le motif « robot non membre » doit être nommé');
  assert.match(texte, /invite/i, 'le geste qui lève « non_membre » — une invitation humaine — doit être dit');
});

test('la compétence dit qu’elle est idempotente et qu’elle n’écrase rien', () => {
  const texte = skill();
  assert.match(texte, /idempotent/i, 'l’idempotence doit être nommée');
  assert.match(texte, /n[e']?\s*(?:re)?touche|ne retouche|n’écrase|jamais édité/i, 'et ce qu’elle ne fait jamais à un lieu déjà posé');
});

test('la compétence exclut explicitement Somcraft des moyens du représentant (RA-REL-015)', () => {
  const texte = skill();
  assert.match(texte, /Somcraft/, 'Somcraft doit être nommé');
  assert.match(texte, /ServiceDesk SEUL|seul.*ServiceDesk|Somcraft.*exclu|exclu.*Somcraft/i, 'et son exclusion doit être explicite, pas implicite');
});

test('la compétence ouvre une PR en BROUILLON, jamais en prêt, et ne la fusionne jamais elle-même', () => {
  const texte = skill();
  assert.match(texte, /gh pr create --draft/, 'la PR doit s’ouvrir en brouillon dès le premier commit');
  assert.ok(!texte.includes('gh pr merge'), 'la compétence ne fusionne jamais sa propre PR');
});

test('la compétence dit ce que le hors-scope exclut : créer le canal, l’ouverture de la session, le rafraîchissement', () => {
  const texte = skill();
  assert.match(texte, /ne crée pas le canal/i, 'création du canal : hors-scope, à dire explicitement');
  assert.match(texte, /n['’]ouvre ni ne connecte/i, 'ouverture/connexion de la session : hors-scope, à dire explicitement');
  assert.match(texte, /ne rafraîchit pas/i, 'rafraîchissement d’un lieu déjà posé : hors-scope, à dire explicitement');
});

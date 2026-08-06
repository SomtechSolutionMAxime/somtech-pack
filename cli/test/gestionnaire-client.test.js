// La compétence de gestion de la relation client — sa DISTRIBUTION et sa CONFORMITÉ.
//
// Deux familles de tests, et aucune n'est décorative :
//
//   1. **Elle arrive là où on l'invoque.** Un gestionnaire client ne s'invoque jamais depuis
//      le dépôt qui produit la compétence : il s'invoque dans une session ouverte pour un
//      client. Une capacité annoncée mais absente après installation est pire qu'une
//      capacité absente (EA-GBL-003, P-01/P-02). La preuve est ce test, pas un coup d'œil.
//
//   2. **Elle décrit l'outillage tel qu'il est.** EF-AGT-002. Le pack s'est déjà fait avoir :
//      une compétence enseignait `herdr wait output …`, une commande qui n'existe pas, et
//      chaque agent qui la suivait perdait du temps sur une erreur qui n'était pas la
//      sienne. Un geste inventé rougit désormais.
//
// Les assertions en NÉGATIF portent ce que la compétence promet de ne jamais faire — ne pas
// exécuter le travail, ne pas prendre le verrou de mise en ligne, ne pas parler au client
// sous un code de dossier. Une promesse que rien ne garde n'est pas une promesse.

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
  // Le premier maillon. S'il casse, tous les suivants mentent en cascade — mieux vaut
  // qu'il le dise lui-même.
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
  // Le mode de panne le plus vicieux de la famille : le fichier est là, l'installation
  // rapporte un succès, et la compétence ne se déclenche JAMAIS parce que son en-tête ne
  // se lit pas. « Annoncée mais absente », sans même le signe d'une absence.
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

test('conformité : chaque option de ligne enseignée existe dans la commande', () => {
  const { options } = outilDeLigne();
  const cites = [...skill().matchAll(/\$LD\s+[a-zà-ÿ-]+[^\n`]*?(--[a-zà-ÿ-]+)/g)].map((m) => m[1]);
  assert.ok(cites.length > 0, 'la compétence doit montrer au moins une option');
  for (const option of cites) {
    assert.ok(options.has(option), `la compétence enseigne « ${option} », que la commande ne connaît pas`);
  }
});

test('conformité : chaque commande de session enseignée est déjà employée ailleurs dans le pack', () => {
  // On ne peut pas interroger l'outil de session depuis ici — il n'est pas versionné dans
  // ce dépôt. Ce qu'on peut faire, et qui aurait suffi à attraper le cas historique
  // (`herdr wait output`, qui n'existe pas) : n'admettre que des formes déjà employées par
  // une compétence éprouvée du pack.
  const reference = readFileSync(join(REPO, '.claude', 'skills', 'orchestrer-chantier', 'SKILL.md'), 'utf8');
  const formes = (texte) => new Set([...texte.matchAll(/\bherdr ([a-z-]+ [a-z-]+)/g)].map((m) => m[1]));

  // Les formes valables se relèvent dans les BLOCS DE COMMANDES de la référence, jamais
  // dans sa prose — et cette distinction n'est pas un détail de rédaction. Sa prose cite
  // nommément `herdr wait output` comme une commande qui n'existe pas ; la relever là
  // reviendrait à valider le contre-exemple. Ce test a survécu à sa première mutation pour
  // cette exacte raison, avant d'être réécrit.
  const blocs = [...reference.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
  const connues = formes(blocs);
  assert.ok(connues.size >= 5, 'les formes de référence n’ont pas été relevées — le test ne prouverait rien');

  // Second filet, indépendant du premier : l'outil de session s'adresse à un OBJET. Une
  // forme dont le premier mot n'en est pas un est un verbe de premier niveau inventé —
  // exactement la famille de `herdr wait …`.
  const objets = ['pane', 'agent', 'tab'];

  for (const forme of formes(skill())) {
    assert.ok(objets.includes(forme.split(' ')[0]), `« herdr ${forme} » ne s’adresse à aucun objet connu — inventé ?`);
    assert.ok(connues.has(forme), `« herdr ${forme} » n’est employé nulle part ailleurs dans le pack — inventé ?`);
  }
});

test('conformité : l’ouverture de ligne enseignée est CLIENTE et porte un titre', () => {
  // Deux oublis qui ne se voient pas à la lecture et qui coûtent cher :
  //   - sans `--nature client`, le canal naît PUBLIC : le portefeuille client est exposé
  //     à quiconque a un compte chez nous, et la ligne parle au client en langage interne ;
  //   - sans `--titre`, la commande REFUSE d'ouvrir depuis T-20260806-0105. La compétence
  //     serait alors inerte au premier geste, ce qu'aucune relecture ne montre.
  const ouvertures = [...skill().matchAll(/\$LD ouvrir[^\n]*(?:\\\n[^\n]*)*/g)].map((m) => m[0]);
  assert.equal(ouvertures.length, 1, 'une session, un client, un canal : une seule ouverture de ligne');
  assert.match(ouvertures[0], /--nature client/, 'le canal d’un client doit naître privé');
  assert.match(ouvertures[0], /--titre/, 'sans titre, la commande refuse d’ouvrir une ligne cliente');
});

// ═══════════════════════════════ 3. ce que la compétence promet — et son négatif

test('la frontière : « est-ce possible ? » est du côté qui REMONTE au dirigeant', () => {
  // Le cas piégeux du cadrage, et le seul qu'un agent tranchera de travers de bonne foi :
  // la réponse paraît factuelle et engage en réalité. S'il glisse un jour dans la colonne
  // « tu réponds seul », la compétence enseigne l'inverse de ce qu'elle existe pour dire.
  const lignes = skill()
    .split('\n')
    .filter((l) => /est-ce possible/i.test(l) && l.trim().startsWith('|'));
  assert.equal(lignes.length, 1, 'le cas doit figurer une fois exactement dans la table de la frontière');

  const colonnes = lignes[0].split('|').map((c) => c.trim());
  const gauche = colonnes[1] || '';
  const droite = colonnes[2] || '';
  assert.ok(!/est-ce possible/i.test(gauche), 'la faisabilité ne se répond pas seul');
  assert.match(droite, /est-ce possible/i, 'la faisabilité remonte au dirigeant');
});

test('la frontière : tout ce qui engage l’organisation est du côté qui remonte', () => {
  const droite = skill()
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => (l.split('|')[2] || '').toLowerCase())
    .join(' ');
  for (const engage of ['délai', 'prix', 'priorité', 'engagement']) {
    assert.ok(droite.includes(engage), `« ${engage} » doit figurer du côté qui remonte`);
  }
});

test('le but posé rend compte AU GESTIONNAIRE, et le dit contre le dirigeant', () => {
  // D5 : l'orchestrateur travaille exactement comme d'habitude ; ce qui change tient au
  // seul but qu'on lui pose. S'il rend compte au dirigeant, le client perd son interlocuteur
  // unique et personne ne s'en aperçoit avant qu'il ne redemande où il en est.
  const texte = skill();
  assert.match(texte, /herdr pane run [^\n]*\/goal/, 'le lancement doit poser un but, sinon l’agent s’arrête au premier palier');

  // Le modèle est la seule occurrence qui porte un contenu réel — celle du bloc de
  // commandes n'est qu'un gabarit. Un seul modèle : deux se contrediraient et on ne
  // saurait plus lequel fait foi.
  const modeles = [...texte.matchAll(/^> `\/goal [^\n]*/gm)].map((m) => m[0]);
  assert.equal(modeles.length, 1, 'un seul but modèle');
  assert.match(modeles[0], /gestionnaire client/i, 'le but doit nommer le destinataire du compte rendu');
  assert.match(modeles[0], /pas au dirigeant/i, 'et dire explicitement que ce n’est pas le dirigeant');
});

test('D1 : la compétence n’ouvre qu’UN pane, et c’est celui de l’exécution', () => {
  // Elle transforme la session courante ; elle ne fait naître aucun agent pour elle-même.
  const texte = skill();
  const ouvertures = [...texte.matchAll(/herdr tab create/g)];
  assert.equal(ouvertures.length, 1, 'un seul pane ouvert : celui du chantier qu’elle lance');

  // Et il naît dans la section du lancement, pas dans celle de la mise en place : c'est là
  // que se joue D1. Un pane ouvert pendant la mise en place voudrait dire que la compétence
  // fait naître un agent POUR ELLE-MÊME, ce qu'elle existe précisément pour éviter.
  const titres = [...texte.matchAll(/^#{2,3} (.+)$/gm)];
  const section = titres.filter((t) => t.index < ouvertures[0].index).pop();
  assert.ok(section, 'le pane doit naître sous un titre de section');
  assert.match(section[1], /Lancer l['’]exécution/, `il naît sous « ${section[1]} », pas dans le lancement`);
});

test('NÉGATIF : elle n’enseigne aucun geste qui exécute le travail (HS-REL-001)', () => {
  // « Il fait faire, il ne réalise pas. » Un interlocuteur qui se met à réaliser cesse
  // d'écouter. La tentation est réelle et arrive toujours par la même porte : « ce petit
  // bout, c'est plus rapide ». Ces gestes-là ne doivent pas exister dans sa compétence.
  const texte = skill();
  const interdits = ['git commit', 'git push', 'git checkout', 'npm publish', '/pousse', '/merge', 'supabase db'];
  for (const geste of interdits) {
    // Seul le mode IMPÉRATIF est proscrit : la table des anti-patterns a le droit de
    // nommer ce qu'on ne fait pas. On cherche donc les blocs de commandes.
    for (const bloc of texte.matchAll(/```bash\n([\s\S]*?)```/g)) {
      assert.ok(!bloc[1].includes(geste), `la compétence enseigne « ${geste} » : elle ne réalise pas`);
    }
  }
});

test('NÉGATIF : elle ne prend jamais le droit d’accès à la mise en ligne (HS-REL-005)', () => {
  // Elle le LIT pour dire la vérité au client ; le prendre et le rendre appartient à celui
  // qui pousse. Un gestionnaire qui l'acquiert bloque la mise en ligne de tout le monde
  // pour une question de suivi — et c'est le second mécanisme de file que le hors-scope
  // interdit, arrivé par la petite porte.
  const texte = skill();
  assert.match(texte, /lock_status/, 'elle doit savoir lire l’état de la mise en ligne');
  assert.ok(!texte.includes('lock_acquire'), 'elle ne prend jamais le droit d’accès');
  assert.ok(!texte.includes('lock_release'), 'ni ne le rend');
});

test('NÉGATIF : le relèvement se lit AVANT de parler, et il est ordonné', () => {
  // EF-REL-012. Une consigne allusive sera lue par un agent, pas par une personne : le
  // chemin doit être une suite de lectures numérotées, pas une intention.
  const section = skill().split(/^## /m).find((s) => /^Le relèvement/.test(s));
  assert.ok(section, 'la compétence doit porter une section de relèvement');

  const etapes = [...section.matchAll(/^\s*\d+\.\s+\S/gm)];
  assert.ok(etapes.length >= 4, `le relèvement doit être une suite de lectures ordonnées (${etapes.length} trouvée·s)`);
  assert.match(section, /action get/, 'il doit relire les demandes une à une, pas seulement leur liste');
  assert.match(section, /commentaires/i, 'c’est le fil de commentaires qui porte ce qui a été compris et promis');
});

// UN LIEU QUI N'A QUE SON SOCLE N'EST PAS UN LIEU (T-20260821-0032).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// VÉCU, 2026-08-21, en faisant naître le premier orchestrateur sur le métier rendu
//
// La pose rend `{"ok":true,"fichiers":[…4…]}`. Quatre fichiers, zéro avertissement. Et le
// socle qu'elle vient de déposer se termine par ONZE renvois :
//
//     **reflexes** — Qui il soutient, sa ronde, ce qu'il ne peut pas faire… → `metier/chapitres/reflexes.md`
//
// Aucun des onze n'existe dans le lieu. La liste des fichiers à copier était ÉCRITE EN DUR,
// et le modèle à trois étages est arrivé après elle.
//
// ⚠️ ET LE MODE D'ÉCHEC EST SILENCIEUX DU MAUVAIS CÔTÉ. Le socle ne ment pas : il annonce
// correctement où chercher. C'est le lieu qui est incomplet. L'agent, ne trouvant rien,
// conclurait vraisemblablement que le chapitre n'existe pas — alors que la règle qu'il porte
// lui interdit précisément de conclure d'une absence.
//
// TROISIÈME INSTANCE DU MÊME MOTIF DANS CE CHANTIER : deux étages justes séparément, et la
// ligne qui les relie que rien ne garde. Les deux précédentes (le rendu contre `pack setup`,
// puis le rendu contre la naissance) ont été trouvées de la même façon — en s'en servant.
//
// ⚠️ CE QUE CETTE SUITE GARDE EST LA JOINTURE, PAS UN COMPTE. Une garde qui exigerait « onze
// fichiers » se périmerait au douzième chapitre et, pire, passerait au vert sur onze fichiers
// qui ne sont pas les bons. Elle lit donc les RENVOIS que le socle écrit, et exige que chaque
// cible existe — la garde suit la fonction, pas un nombre.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { posteFabrique } from './foyer-de-reference.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(ICI, '..', '..');
const GABARITS_SRC = join(REPO, '.claude', 'templates');

let preparerLieuOrchestrateur, preparerLieuRepresentant;
const bacs = [];
const POSTE = posteFabrique(GABARITS_SRC, ['orchestrateur', 'gestionnaire-client'], bacs);

before(async () => {
  ({ preparerLieuOrchestrateur } = await import('../src/orchestrateur.js'));
  ({ preparerLieuRepresentant } = await import('../src/representant.js'));
});
after(() => {
  POSTE.rendre();
  for (const b of bacs) rmSync(b, { recursive: true, force: true });
});

function depotGit(roles = ['orchestrateur']) {
  const racine = mkdtempSync(join(tmpdir(), 'ld-metier-'));
  bacs.push(racine);
  execFileSync('git', ['init', '-q', racine]);
  execFileSync('git', ['-C', racine, 'config', 'user.email', 'essai@somtech.ca']);
  execFileSync('git', ['-C', racine, 'config', 'user.name', 'essai']);
  for (const r of roles) {
    cpSync(join(GABARITS_SRC, r), join(racine, '.claude', 'templates', r), { recursive: true });
  }
  return racine;
}

const OUVRABLE = async () => ({ joignable: true });

/** Les cibles que le socle annonce — `metier/chapitres/<nom>.md` dans ses renvois. */
function renvoisDu(socle) {
  return [...new Set([...socle.matchAll(/`(metier\/[^`]+\.md)`/g)].map((m) => m[1]))];
}

// Les deux poses n'ont PAS la même façade, et c'est leur métier qui l'impose : un
// orchestrateur CRÉE sa ligne au premier geste, un représentant REJOINT un canal client
// qu'un humain a ouvert. On appelle donc chacune dans sa forme, plutôt que d'inventer un
// adaptateur qui masquerait la différence — et le jour où l'une change, l'essai le dit.
const POSES = [
  ['orchestrateur', 'orchestrateur',
   (depot, nom) => preparerLieuOrchestrateur({ depot, nom, verifierLigne: OUVRABLE })],
  ['representant', 'gestionnaire-client',
   (depot, nom) => preparerLieuRepresentant({
     depotClient: depot, client: nom, canal: '#essai-canal',
     verifierJoignabilite: OUVRABLE,
   })],
];

for (const [role, gabarit, poser] of POSES) {
  test(`« ${role} » : chaque renvoi du socle vise un fichier qui EXISTE dans le lieu posé`, async () => {
    const depot = depotGit([gabarit]);
    const r = await poser(depot, `p-${role}`);
    assert.equal(r.ok, true, `la pose doit réussir : ${JSON.stringify(r.refus ?? {})}`);

    const socle = readFileSync(join(r.racine, 'CLAUDE.md'), 'utf8');
    const renvois = renvoisDu(socle);

    // ⚠️ Sans cette borne, un socle qui perdrait tous ses renvois rendrait la garde VERTE
    // sur zéro vérification — le contrôle qui ne trouve rien à vérifier passe pour satisfait.
    assert.ok(renvois.length >= 5,
      `le socle de « ${role} » doit annoncer ses chapitres (${renvois.length} renvoi·s lu·s)`);

    const absents = renvois.filter((c) => !existsSync(join(r.racine, c)));
    assert.deepEqual(absents, [],
      `le socle annonce ${renvois.length} chapitre·s ; ${absents.length} manque·nt au lieu`);
  });

  test(`« ${role} » : la pose ANNONCE les chapitres qu'elle a déposés`, async () => {
    const depot = depotGit([gabarit]);
    const r = await poser(depot, `a-${role}`);
    const chapitres = r.fichiers.filter((f) => f.startsWith('metier/'));
    assert.ok(chapitres.length >= 5,
      `« fichiers » doit porter ce qui a été posé, chapitres compris (${JSON.stringify(r.fichiers)})`);
  });

  test(`« ${role} » : un lieu à qui il manque un chapitre est PARTIEL, jamais installé`, async () => {
    const { etatLieu } = await import('../src/lieu-agent.js');
    const depot = depotGit([gabarit]);
    const r = await poser(depot, `b-${role}`);

    const victime = r.fichiers.find((f) => f.startsWith('metier/'));
    assert.ok(victime, 'il faut un chapitre à retirer pour éprouver quoi que ce soit');
    rmSync(join(r.racine, victime));

    const etat = etatLieu(depot, role === 'orchestrateur' ? 'orchestrateur' : 'representant', `b-${role}`);
    assert.equal(etat.complet, false,
      `un lieu privé de « ${victime} » ne peut pas être déclaré complet`);
    assert.ok(etat.manquants.includes(victime), `« ${victime} » doit être nommé parmi les manquants`);
  });
}

test('⚠️ la liste des fichiers posés se DÉRIVE du gabarit — un étage neuf n exige aucune édition', async () => {
  // La garde qui empêche la prochaine occurrence : on ajoute au gabarit un fichier qu'aucune
  // liste en dur ne connaît, et la pose doit le déposer quand même. Sans ça, le quatrième
  // étage du métier sera oublié exactement comme le troisième l'a été.
  const depot = depotGit(['orchestrateur']);
  // ⚠️ DANS LES DEUX SOURCES. La garde de fraîcheur compare le gabarit du dépôt à celui du
  // poste par EMPREINTE : n'ajouter le fichier que d'un côté les fait diverger, et l'essai
  // mesurerait alors ce refus-là au lieu de ce qu'il prétend éprouver.
  for (const racine of [depot, join(POSTE.foyer, '.claude', 'plugins', 'marketplaces', 'somtech-pack')]) {
    const inedit = join(racine, '.claude', 'templates', 'orchestrateur', 'metier', 'lexique', 'mots.md');
    mkdirSync(dirname(inedit), { recursive: true });
    writeFileSync(inedit, '# un étage que personne n a codé en dur\n');
  }

  const r = await preparerLieuOrchestrateur({ depot, nom: 'c-inedit', verifierLigne: OUVRABLE });
  assert.equal(r.ok, true, JSON.stringify(r.refus ?? {}));
  assert.ok(existsSync(join(r.racine, 'metier', 'lexique', 'mots.md')),
    'un fichier neuf du gabarit doit arriver dans le lieu sans qu une liste ait été modifiée');
});

test('⚠️ gabarit HORS D ATTEINTE : on retombe sur les obligatoires, jamais sur RIEN', async () => {
  // Le repli compte autant que le cas normal. `etatLieu` s'appelle aussi sur un dépôt qui n'a
  // pas (ou plus) les gabarits : si la dérivation rendait une liste VIDE, tout lieu — même
  // un répertoire nu — serait déclaré COMPLET, puisque rien ne manquerait. Le repli doit
  // donc rendre le plancher, pas le vide : c'est le plus qu'on puisse affirmer sans le
  // gabarit, et on ne l'affirme pas plus fort que ça.
  const { fichiersDuGabarit, etatLieu, GABARITS } = await import('../src/lieu-agent.js');
  const nu = mkdtempSync(join(tmpdir(), 'ld-nu-'));
  bacs.push(nu);

  assert.deepEqual(fichiersDuGabarit(nu, 'orchestrateur').sort(), [...GABARITS].sort(),
    'sans gabarit, les obligatoires restent attendus');

  mkdirSync(join(nu, '.orchestrateur', 'vide'), { recursive: true });
  const etat = etatLieu(nu, 'orchestrateur', 'vide');
  assert.equal(etat.complet, false, 'un répertoire nu ne peut jamais être déclaré complet');
});

test('⚠️ un OBLIGATOIRE qui n est pas un fichier régulier reste dans la liste — jamais sauté en silence', async () => {
  // ATTRAPÉ PAR LA CHAÎNE, PAS PAR LE POSTE, et c'est le fait qui compte ici. La marche du
  // gabarit ne retient que les fichiers réguliers ; un obligatoire remplacé par un RÉPERTOIRE
  // en était donc silencieusement absent, et la pose rendait « ok » sur un lieu amputé. Un
  // crash laisse une trace, une omission non — c'est le pire des deux.
  //
  // Sur le poste, l'essai qui gardait ça passait POUR LE MAUVAIS MOTIF : la garde de fraîcheur
  // refusait d'abord, pour une autre raison. Vert chez l'auteur, rouge en chaîne. Cet essai-ci
  // ne dépend d'aucune des deux : il interroge la dérivation directement.
  const { fichiersDuGabarit, GABARITS } = await import('../src/lieu-agent.js');
  const depot = depotGit(['orchestrateur']);
  const gab = join(depot, '.claude', 'templates', 'orchestrateur');

  rmSync(join(gab, 'CONTEXTE.md'));
  mkdirSync(join(gab, 'CONTEXTE.md'));

  const liste = fichiersDuGabarit(depot, 'orchestrateur');
  for (const f of GABARITS) {
    assert.ok(liste.includes(f),
      `« ${f} » est obligatoire : il reste attendu même quand il n est pas copiable, ` +
      `pour que la pose ÉCHOUE au lieu de se raccourcir`);
  }
});

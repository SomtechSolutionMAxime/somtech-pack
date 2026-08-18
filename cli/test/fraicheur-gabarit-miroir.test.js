// LE VERROU DE LA GARDE UNIQUE DE FRAÎCHEUR (E-20260818-0014, T-20260818-0112).
//
// La pose (`ligne-directe/src/lieu-agent.js`) et la mise à jour (`cli/src/commands/
// representant.js`) doivent juger la fraîcheur d'un gabarit AVEC LE MÊME TEXTE. Deux gardes
// qui jugeraient chacune de leur côté se déphaseraient au premier correctif — c'est le défaut
// que `lieu-nom.js` a déjà payé sur ce dépôt (T-20260814-0101), et pour la même raison de
// distribution : le paquet npm du CLI n'embarque que `bin/`, `src/` et `payload/`, il ne peut
// donc pas importer un module de poste.
//
// Ce fichier est ce qui rend la duplication INOFFENSIVE — et il ne se contente pas de comparer
// des octets : il fait TRAVAILLER les deux exemplaires sur le même corpus. Une comparaison de
// textes ne dirait rien du jour où l'un des deux serait chargé depuis ailleurs (un paquet
// publié, un `--source`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const REPO = resolve(HERE, '..', '..');

const SOURCE = join(REPO, 'ligne-directe', 'src', 'fraicheur-gabarit.js');
const COPIE = join(CLI_DIR, 'src', 'fraicheur-gabarit.js');
const GABARITS_SRC = join(REPO, '.claude', 'templates');

test('la garde de fraîcheur est le MÊME TEXTE des deux côtés — octet pour octet', () => {
  assert.ok(
    readFileSync(SOURCE).equals(readFileSync(COPIE)),
    'ligne-directe/src/fraicheur-gabarit.js et cli/src/fraicheur-gabarit.js ont divergé — deux '
      + 'gardes de fraîcheur dans le même pack. Corriger la SOURCE (ligne-directe), puis '
      + '« node cli/scripts/sync-fraicheur-gabarit.mjs ».',
  );
});

test('le script qui refait la copie existe — sans lui, tenir le miroir demanderait de la discipline', () => {
  assert.ok(
    existsSync(join(CLI_DIR, 'scripts', 'sync-fraicheur-gabarit.mjs')),
    'cli/scripts/sync-fraicheur-gabarit.mjs est le geste qui répare le miroir ; le message du test ci-dessus le cite',
  );
});

test('les deux exemplaires rendent le MÊME VERDICT — prouvé en les faisant juger, pas en lisant leur texte', async () => {
  const [source, copie] = await Promise.all([
    import(pathToFileURL(SOURCE).href),
    import(pathToFileURL(COPIE).href),
  ]);

  // Un poste jetable et trois dépôts : à jour, divergent, sans gabarit. Plus un poste nu.
  const foyer = mkdtempSync(join(tmpdir(), 'mir-poste-'));
  cpSync(GABARITS_SRC, join(foyer, source.SOUS_CHEMIN_REFERENCE), { recursive: true });
  const foyerNu = mkdtempSync(join(tmpdir(), 'mir-nu-'));

  const aJour = mkdtempSync(join(tmpdir(), 'mir-ok-'));
  cpSync(join(GABARITS_SRC, 'orchestrateur'), join(aJour, '.claude', 'templates', 'orchestrateur'), { recursive: true });
  const divergent = mkdtempSync(join(tmpdir(), 'mir-ko-'));
  cpSync(join(GABARITS_SRC, 'orchestrateur'), join(divergent, '.claude', 'templates', 'orchestrateur'), { recursive: true });
  writeFileSync(join(divergent, '.claude', 'templates', 'orchestrateur', 'CLAUDE.md'), '# pilote\n');
  const sansGabarit = mkdtempSync(join(tmpdir(), 'mir-nul-'));
  // Le dépôt-source du pack, dont le gabarit fait foi : la troisième forme du verdict.
  const laSource = mkdtempSync(join(tmpdir(), 'mir-src-'));
  cpSync(join(GABARITS_SRC, 'orchestrateur'), join(laSource, '.claude', 'templates', 'orchestrateur'), { recursive: true });
  writeFileSync(join(laSource, '.claude', 'templates', 'orchestrateur', 'CLAUDE.md'), '# en cours de travail\n');
  writeFileSync(join(laSource, 'pack.json'), '{"name":"somtech-pack"}');

  const CORPUS = [
    { depot: aJour, foyer }, { depot: divergent, foyer }, { depot: sansGabarit, foyer },
    { depot: aJour, foyer: foyerNu }, { depot: divergent, foyer: foyerNu },
    { depot: laSource, foyer }, { depot: divergent, foyer: undefined },
  ];
  for (const { depot, foyer: f } of CORPUS) {
    const args = { depot, gabaritDepot: join(depot, '.claude', 'templates', 'orchestrateur'), gabarit: 'orchestrateur', libelle: 'orchestrateur', foyer: f };
    assert.deepEqual(
      copie.verifierFraicheur(args), source.verifierFraicheur(args),
      `les deux exemplaires jugent « ${depot} » différemment — la garde a divergé EN FAIT, pas seulement en texte`,
    );
    assert.equal(
      copie.empreinteGabarit(args.gabaritDepot), source.empreinteGabarit(args.gabaritDepot),
      `les deux exemplaires mesurent « ${depot} » différemment`,
    );
  }

  // Et le témoin : ce corpus fait bien travailler les trois formes du verdict, sinon
  // l'accord des deux exemplaires ne prouverait qu'un accord sur un seul chemin.
  const vus = new Set(CORPUS.map(({ depot, foyer: f }) => {
    const v = source.verifierFraicheur({ depot, gabaritDepot: join(depot, '.claude', 'templates', 'orchestrateur'), gabarit: 'orchestrateur', foyer: f });
    return v.perime ? 'perime' : v.verifie ? 'verifie' : 'non-mesure';
  }));
  assert.deepEqual([...vus].sort(), ['non-mesure', 'perime', 'verifie']);
});

test('LA RÉFÉRENCE NE VIENT QUE DU PACK DU POSTE — jamais d’un payload, qui est un produit de build', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // DEMANDÉ EXPLICITEMENT. Ce qui est MESURÉ sur ce poste (2026-08-18) : `init`, `update` et
  // `setup` installent depuis `cli/payload` ; ce répertoire est ignoré par git
  // (`.gitignore:13`) et produit par `build:payload`. Son gabarit CONCORDE aujourd'hui avec
  // celui du dépôt, et le chemin du paquet publié a fait converger ce poste vers `main` aux
  // trois installations du jour. `[non établi]` : qu'un payload servi puisse être périmé en
  // pratique — on ne l'a pas constaté, on ne le conclut pas.
  //
  // Ce que ce test garde ne dépend pas de cette question, et c'est le but : quelle que soit la
  // fraîcheur d'un payload, il ne doit jamais devenir la RÉFÉRENCE. Sinon la garde validerait
  // un gabarit contre un autre gabarit de même provenance — un vert qui ne touche pas ce qu'il
  // prétend éprouver.
  //
  // Le payload est ce qu'on MESURE (`cmdLieuUpdate` lui passe `sourceDir`), jamais ce contre
  // quoi on mesure. Ce test l'exige sur le TEXTE de la résolution, parce que c'est là que la
  // porte s'ouvrirait : un candidat de plus dans `referenceDuPoste`, et c'est fait.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const src = readFileSync(SOURCE, 'utf8');
  const sansCommentaires = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  for (const interdit of [/payload/i, /resolvePayloadRoot/, /SOMTECH_PACK_PAYLOAD/, /_npx/, /node_modules/]) {
    assert.ok(
      !interdit.test(sansCommentaires),
      `la résolution de la référence connaît « ${interdit} » — un produit de build peut devenir la référence`,
    );
  }
  // ⚠️ CE TEST-CI NE REGARDE QUE DU TEXTE, et un texte ne prouve rien d'un comportement : la
  // preuve PAR LE FAIT est le test suivant, qui pose de vrais payloads et constate que la
  // référence reste introuvable. Les deux, parce que le texte ferme la porte AVANT qu'elle
  // s'ouvre, et le fait la ferme si elle s'ouvrait autrement.
});

test('la référence reste INTROUVABLE même quand un payload à jour est posé sous le foyer — prouvé par le fait', async () => {
  const { referenceDuPoste } = await import(pathToFileURL(COPIE).href);

  const foyerNu = mkdtempSync(join(tmpdir(), 'mir-payload2-'));
  // Tout ce qu'un payload peut ressembler, posé aux endroits plausibles sous le foyer.
  for (const sousChemin of [
    ['payload', '.claude', 'templates', 'orchestrateur'],
    ['.npm', '_npx', 'abcdef', 'node_modules', '@somtech-solutions', 'pack', 'payload', '.claude', 'templates', 'orchestrateur'],
  ]) {
    const cible = join(foyerNu, ...sousChemin);
    mkdirSync(dirname(cible), { recursive: true });
    cpSync(join(GABARITS_SRC, 'orchestrateur'), cible, { recursive: true });
  }

  const r = referenceDuPoste('orchestrateur', { foyer: foyerNu });
  assert.equal(r.chemin, null, 'un payload a été pris pour la référence du poste');
  assert.ok(r.raison.includes('marketplaces'), 'la raison ne nomme pas le seul lieu où la référence est cherchée');
});

test('la garde ne dépend que de « node: » — sans quoi la copie tomberait chez le client, pas en CI', () => {
  const imports = [...readFileSync(COPIE, 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  const etrangers = imports.filter((i) => !i.startsWith('node:'));
  assert.deepEqual(etrangers, [], `la copie importe ${etrangers.join(', ')} — ces modules n’existent pas dans le paquet publié`);
});

test('LA MISE À JOUR passe par la garde unique — elle n’a pas sa propre idée de la fraîcheur', () => {
  const src = readFileSync(join(CLI_DIR, 'src', 'commands', 'representant.js'), 'utf8');
  const sansCommentaires = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  assert.match(sansCommentaires, /from '\.\.\/fraicheur-gabarit\.js'/, 'representant.js doit importer la garde unique');
  assert.match(sansCommentaires, /verifierFraicheur\(/, 'representant.js doit APPELER la garde, pas seulement l’importer');
  // Une seconde idée de la fraîcheur renaîtrait par là : une comparaison de versions.
  assert.ok(
    !/version.*(<|>|localeCompare|semver)/i.test(sansCommentaires),
    'representant.js compare des VERSIONS — la fraîcheur se juge par empreinte (T-20260816-0020)',
  );
});

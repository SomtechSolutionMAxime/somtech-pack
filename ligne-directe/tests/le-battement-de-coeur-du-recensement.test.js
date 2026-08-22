// LE BATTEMENT DE CŒUR DU RECENSEMENT — mesuré dans un bac jetable, jamais dans le journal vivant.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EST SÉPARÉ, ET C'EST UNE GARDE
//
// `journaliser` écrit dans `CHEMIN_JOURNAL`, figé au CHARGEMENT de `registre.js` depuis
// `LIGNE_DIRECTE_RACINE`. Un banc qui importe `veilleur.js` en tête a donc déjà figé la racine
// sur le poste RÉEL — et le journal du poste est alimenté en continu par le veilleur vivant.
//
// ⚠️ MESURÉ : une première version de cette garde vivait dans le banc de câblage et comparait la
// taille du fichier avant/après. Elle a SURVÉCU à la mutation qui décâble le battement de cœur —
// parce que le veilleur du poste écrivait entre les deux mesures. Un banc dont le verdict dépend
// d'un autre processus ne garde rien, et finit désarmé « parce qu'il est instable ».
//
// La racine est donc posée sur un bac jetable AVANT tout import. L'ordre n'est pas une
// coquetterie : importer d'abord ferait mesurer le journal du dirigeant.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let bac;
let CHEMIN_JOURNAL;
let Veilleur;
let posteHerdr;

before(async () => {
  bac = mkdtempSync(join(tmpdir(), 'battement-'));
  process.env.LIGNE_DIRECTE_RACINE = join(bac, 'racine');
  ({ CHEMIN_JOURNAL } = await import('../src/registre.js'));
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ posteHerdr } = await import('./aide/faux-herdr.js'));
  // Le module DOIT avoir suivi la racine jetable — sans cette ligne, ce banc écrirait dans le
  // journal du poste et mesurerait le travail d'autrui.
  assert.equal(CHEMIN_JOURNAL, join(bac, 'racine', 'veilleur.log'));
});
after(() => rmSync(bac, { recursive: true, force: true }));

test('LE RECENSEMENT ÉCRIT SA TRACE — une ronde éteinte est indiscernable d’une ronde qui tourne', async () => {
  // ⚠️ MUTATION SURVIVANTE, TROUVÉE PAR LES DEUX PASSES DU CYCLE 6. Décâbler `journaliser` du
  // site d'appel laissait les 840 essais verts : la ronde repartait toutes les 15 minutes et
  // n'écrivait plus rien. C'est mot pour mot ce que `recenser()` déclare vouloir empêcher — et
  // le journal réel est la SEULE preuve qu'elle tourne.
  const p = posteHerdr(bac, [], 'battement');
  const depot = join(bac, 'depot');
  const lieu = join(depot, '.orchestrateur', 'd-20260822-0006');
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), "# Tu es l'orchestrateur de ce chantier\n\nmétier.\n");
  writeFileSync(join(lieu, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n\nrien.\n');
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  p.pane('w1:p1', { boite: '' });
  p.panes([{ pane_id: 'w1:p1', foreground_cwd: lieu }]);

  const v = new Veilleur({ cheminSocket: join(bac, 'battement.sock'), identite: { equipe: 'B' } });
  const avant = { PATH: process.env.PATH, HOME: process.env.HOME, HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH };
  try {
    process.env.PATH = p.path;
    process.env.FAUX_HERDR_ETAT = p.etat;
    process.env.HOME = join(bac, 'foyer-jetable');
    process.env.HERDR_SOCKET_PATH = join(p.etat, 'socket');
    await v.recensementDuPoste();
  } finally {
    for (const [cle, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
    delete process.env.FAUX_HERDR_ETAT;
  }

  assert.ok(existsSync(CHEMIN_JOURNAL), 'le recensement doit avoir écrit — le journal n’existe même pas');
  const trace = readFileSync(CHEMIN_JOURNAL, 'utf8');
  // ⚠️ ON EXIGE LE CONTENU, PAS SEULEMENT LA TAILLE — ici c'est possible, parce que personne
  // d'autre n'écrit dans ce bac. C'est exactement ce que la version précédente ne pouvait pas
  // faire, et c'est pour ça qu'elle ne mordait pas.
  assert.match(trace, /recensement —/, 'la trace nomme le geste');
  assert.match(trace, /1 pane\(s\) vus/, 'et porte ce qu’elle a vu');
  assert.match(trace, /AU MOINS 1 agent\(s\)/, 'et son compte, annoncé comme un plancher');
});

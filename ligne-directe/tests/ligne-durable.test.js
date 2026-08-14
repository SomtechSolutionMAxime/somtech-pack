// UNE LIGNE DURABLE NE S'ARCHIVE PAS — et une ligne refermée doit pouvoir rouvrir (T-20260814-0085).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI EST ARRIVÉ, LE 2026-08-14 À 17 H 28, EN PRODUCTION
//
// Une ligne d'orchestrateur a été refermée avec son bilan, puis rouverte sous le même titre
// pour réparer autre chose. La réouverture a ÉCHOUÉ : le canal venait d'être archivé, Slack
// refuse un homonyme d'un canal archivé, et le désarchivage est réservé à un compte humain.
// La ligne s'est retrouvée fermée ET irrécupérable sous son nom — un état PIRE que le départ.
// La seule sortie a été d'en créer une autre sous un titre différent, donc de perdre le lien
// entre le canal et le chantier tel qu'il était nommé.
//
// LA CAUSE N'EST PAS SLACK, C'EST UNE DÉDUCTION QUI A CESSÉ D'ÊTRE VRAIE. Le code lisait la
// jetabilité d'une ligne dans sa NATURE : `client` → on garde, tout le reste → on archive. La
// règle « un canal interne naît avec un chantier et meurt avec lui » valait quand toutes les
// lignes internes étaient des lignes de chantier. Elle a cessé de valoir en v1.45.0, quand la
// ligne permanente entre un gestionnaire et le dirigeant est devenue une ligne interne elle
// aussi — et l'incident montre qu'une ligne de chantier long est durable pour la même raison :
// on peut avoir besoin de la refaire.
//
// ⚠️ LE REPLI PENCHE DU CÔTÉ SÛR, ET CE N'EST PAS UN DÉTAIL. Archiver est IRRÉVERSIBLE pour
// nous ; ne pas archiver laisse un canal qu'un humain ferme en trente secondes. Une ligne dont
// on ne sait rien — celles déjà au registre, écrites par une version qui n'avait pas ce
// champ — est donc DURABLE. Lire la jetabilité comme `natureDe` lit la nature (`=== 'durable'
// ? durable : jetable`) aurait rejoué le défaut sur tout le parc existant.
//
// ⚠️ LE CANAL DU CLIENT RESTE HORS DE CAUSE. Sa protection est acquise, elle a tenu tout du
// long, et les essais qui la gardent vivent dans `canal-du-client.test.js`. Ce fichier ajoute
// une garde, il n'en remplace aucune.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fauxSlack } from './aide/faux-slack.js';

const execFileAsync = promisify(execFile);
const ICI = dirname(fileURLToPath(import.meta.url));
const CLI = join(ICI, '..', 'bin', 'ligne-directe.js');

let Veilleur, sauverRegistre, chargerRegistre, jetabiliteDe;
let racine;
let binFaux;
let compteur = 0;

const UDIR = 'UDIR';
const UMOI = 'UMOI';
const PANE = 'w1:p1';
const DIRIGEANT = { id: UDIR, courriel: 'dirigeant@somtech.ca' };

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-durable-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre, jetabiliteDe } = await import('../src/registre.js'));

  binFaux = join(racine, 'bin');
  mkdirSync(binFaux, { recursive: true });
  const faux = join(binFaux, 'herdr');
  writeFileSync(
    faux,
    `#!${process.execPath}\n` +
      `const a = process.argv.slice(2).join(' ');\n` +
      `if (a === 'pane current') {\n` +
      `  process.stdout.write(JSON.stringify({ result: { pane: { pane_id: process.env.FAUX_PANE, foreground_cwd: '/w' } } }));\n` +
      `} else {\n` +
      `  process.stdout.write(JSON.stringify({ error: { code: 'unsupported', message: a } }));\n` +
      `}\n`
  );
  chmodSync(faux, 0o755);
});

after(() => rmSync(racine, { recursive: true, force: true }));
beforeEach(() => sauverRegistre({ version: 1, lignes: [], commun: null, dirigeant: DIRIGEANT }));

function agentsQuiVivent({ panes = [PANE] } = {}) {
  return {
    async vivant(pane) {
      return panes.includes(pane);
    },
    async remettre() {
      return { delivered: true };
    },
    async agents() {
      return panes.map((p) => ({ agent: 'claude', pane_id: p, herdr_socket: null }));
    },
  };
}

async function avecPoste({ canaux = [], panes = [PANE] }, corps) {
  const monde = fauxSlack({
    canaux,
    utilisateurs: [{ id: UDIR, name: 'maxime', profile: { real_name: 'Maxime', email: DIRIGEANT.courriel } }],
  }).installer();
  const v = new Veilleur({
    cheminSocket: join(racine, 'veilleur.sock'),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: UMOI },
    herdr: agentsQuiVivent({ panes }),
  });
  await v.ecouterLocal();
  const ld = async (args, pane = PANE) => {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
        env: { ...process.env, LIGNE_DIRECTE_RACINE: racine, PATH: binFaux, FAUX_PANE: pane },
      });
      return { code: 0, stdout, stderr };
    } catch (err) {
      return { code: err.code ?? 1, stdout: err.stdout || '', stderr: err.stderr || '' };
    }
  };
  compteur += 1;
  try {
    return await corps({ monde, ld, veilleur: v });
  } finally {
    await v.arreter();
    monde.restaurer();
  }
}

// ═════════════════ 1. LA BOUCLE QUI A ÉCHOUÉ EN PRODUCTION

test('REFERMER PUIS ROUVRIR SOUS LE MÊME TITRE — la recette qui a laissé une ligne morte le 2026-08-14', async () => {
  // L'ESSAI QUI MANQUAIT. Chaque geste était couvert séparément — la fermeture archive, la
  // création refuse un canal archivé — et personne n'avait joué les deux à la suite. C'est
  // exactement l'enchaînement qu'un humain fait pour réparer une ligne, et le seul qui casse.
  await avecPoste({}, async ({ monde, ld }) => {
    assert.equal((await ld(['ouvrir', 'j-1', '--titre', 'Finalisation du CRM', '--au-dirigeant'])).code, 0);
    const idAvant = monde.canalNomme('finalisation-du-crm').id;

    const f = await ld(['fermer', 'j-1', '--bilan', 'chantier terminé']);
    assert.equal(f.code, 0, f.stderr);

    const r = await ld(['ouvrir', 'j-1', '--titre', 'Finalisation du CRM', '--au-dirigeant']);
    assert.equal(r.code, 0, `rouvrir sous le même titre doit marcher : ${r.stdout}${r.stderr}`);
    assert.equal(
      monde.canalNomme('finalisation-du-crm').id,
      idAvant,
      'et c’est LE MÊME canal qui reprend — changer de titre perdrait le lien avec le chantier'
    );
  });
});

test('UNE LIGNE INTERNE NE S’ARCHIVE PLUS À LA FERMETURE — elle est durable jusqu’à preuve du contraire', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    assert.equal((await ld(['ouvrir', 'j-1', '--titre', 'Finalisation du CRM', '--au-dirigeant'])).code, 0);
    const f = await ld(['fermer', 'j-1', '--bilan', 'chantier terminé']);
    assert.equal(f.code, 0, f.stderr);

    assert.equal(monde.canalNomme('finalisation-du-crm').is_archived, false, 'le canal doit rester ouvert');
    assert.match(f.stdout, /"archive":\s*false/, 'et la réponse doit le dire — pas prétendre l’avoir archivé');
  });
});

test('LE BILAN PART QUAND MÊME — ne plus archiver ne veut pas dire ne plus refermer', async () => {
  // NON-RÉGRESSION. Refermer garde tout son sens : le bilan est posté, la ligne est close au
  // registre, l'agent n'écoute plus. Seul le geste irréversible disparaît.
  await avecPoste({}, async ({ monde, ld }) => {
    await ld(['ouvrir', 'j-1', '--titre', 'Finalisation du CRM', '--au-dirigeant']);
    await ld(['fermer', 'j-1', '--bilan', 'chantier terminé']);

    assert.ok(
      monde.postes.some((p) => String(p.text || '').includes('chantier terminé')),
      'le bilan doit avoir été posté dans le canal'
    );
    assert.equal(chargerRegistre().lignes.filter((l) => !l.close_le).length, 0, 'et la ligne est close au registre');
  });
});

// ═════════════════ 2. CE QUI RESTE JETABLE L'EST PARCE QU'ON L'A DIT

test('UNE LIGNE DÉCLARÉE JETABLE S’ARCHIVE, ELLE — la catégorie existe, elle n’est plus déduite', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    assert.equal((await ld(['ouvrir', 'j-2', '--titre', 'Essai jetable', '--au-dirigeant', '--jetable'])).code, 0);
    const f = await ld(['fermer', 'j-2', '--bilan', 'fini']);
    assert.equal(f.code, 0, f.stderr);

    assert.equal(monde.canalNomme('essai-jetable').is_archived, true, 'une ligne jetable s’archive');
    assert.match(f.stdout, /"archive":\s*true/);
  });
});

test('LA JETABILITÉ EST INSCRITE AU REGISTRE — elle ne se redevine pas à la fermeture', async () => {
  await avecPoste({}, async ({ ld }) => {
    await ld(['ouvrir', 'j-1', '--titre', 'Ligne durable', '--au-dirigeant']);
    await ld(['ouvrir', 'j-2', '--titre', 'Ligne jetable', '--au-dirigeant', '--jetable'], 'w1:p1');

    const lignes = chargerRegistre().lignes;
    assert.equal(jetabiliteDe(lignes.find((l) => l.chantier === 'j-1')), 'durable');
    assert.equal(jetabiliteDe(lignes.find((l) => l.chantier === 'j-2')), 'jetable');
  });
});

test('UNE LIGNE ÉCRITE PAR UNE VERSION ANTÉRIEURE EST DURABLE — le silence penche du côté réparable', async () => {
  // ⚠️ LE SENS DU REPLI EST LA DÉCISION LA PLUS IMPORTANTE DE CE LOT. Le registre survit aux
  // versions du pack et rien ne migre : les lignes déjà ouvertes chez le dirigeant n'ont pas ce
  // champ. Les lire comme jetables aurait laissé le défaut entier sur tout le parc existant —
  // et ce sont précisément les lignes qui ont mordu.
  assert.equal(jetabiliteDe({ chantier: 'j-ancienne', nature: 'interne' }), 'durable');
  assert.equal(jetabiliteDe({ chantier: 'j-ancienne' }), 'durable');
  assert.equal(jetabiliteDe({ jetable: 'oui' }), 'durable', 'une valeur qui n’est pas `true` ne rend rien jetable');
  assert.equal(jetabiliteDe({ jetable: true }), 'jetable');
});

// ═════════════════ 3. LE BALAYAGE DU VEILLEUR SUIT LA MÊME RÈGLE — l'autre porte

test('UN AGENT DISPARU NE FAIT PAS ARCHIVER SA LIGNE DURABLE — les deux portes, pas une', async () => {
  // `reconcilier` est le SECOND site d'archivage, et il s'exécute tout seul au démarrage du
  // veilleur. Ne garder que `fermer` aurait rejoué « une porte sur deux » — dix occurrences
  // mesurées dans ce dépôt, dont deux dans le correctif d'un défaut de cette famille.
  const canal = { id: 'C_j1', name: 'chantier-orphelin', is_private: false, membres: [UMOI, UDIR] };
  // ⚠️ UN AGENT VIVANT, MAIS PAS CELUI-LÀ. Le veilleur REPORTE le balayage quand herdr ne
  // rend aucun agent — sans quoi lire une liste vide comme « tout le monde est mort »
  // refermerait toutes les lignes vivantes à chaque redémarrage. Monter l'essai sans aucun
  // agent le faisait donc passer par cette garde-là, et il n'aurait rien prouvé du chemin
  // d'archivage qu'il existe pour éprouver.
  await avecPoste({ canaux: [canal], panes: [PANE] }, async ({ monde, veilleur }) => {
    sauverRegistre({
      version: 1,
      dirigeant: DIRIGEANT,
      commun: null,
      lignes: [
        {
          chantier: 'j-1',
          canal_id: 'C_j1',
          canal_nom: 'chantier-orphelin',
          pane: 'w7:p7', // ce pane n'existe plus
          worktree: '/w',
          nature: 'interne',
          libelle: 'j-1',
          autorises: [UDIR],
          pair: null,
          visage: ':robot_face:',
          ouverte_le: '2026-08-14T10:00:00.000Z',
          close_le: null,
        },
      ],
    });
    veilleur.registre = chargerRegistre();

    await veilleur.reconcilier();

    assert.equal(monde.canalNomme('chantier-orphelin').is_archived, false, 'la ligne durable garde son canal');
    assert.equal(chargerRegistre().lignes[0].close_le !== null, true, 'mais elle est bien refermée');
  });
});

test('UN AGENT DISPARU SUR UNE LIGNE JETABLE ARCHIVE, LUI — le balayage n’est pas devenu inerte', async () => {
  const canal = { id: 'C_j2', name: 'essai-orphelin', is_private: false, membres: [UMOI, UDIR] };
  await avecPoste({ canaux: [canal], panes: [PANE] }, async ({ monde, veilleur }) => {
    sauverRegistre({
      version: 1,
      dirigeant: DIRIGEANT,
      commun: null,
      lignes: [
        {
          chantier: 'j-2',
          canal_id: 'C_j2',
          canal_nom: 'essai-orphelin',
          pane: 'w7:p7',
          worktree: '/w',
          nature: 'interne',
          jetable: true,
          libelle: 'j-2',
          autorises: [UDIR],
          pair: null,
          visage: ':robot_face:',
          ouverte_le: '2026-08-14T10:00:00.000Z',
          close_le: null,
        },
      ],
    });
    veilleur.registre = chargerRegistre();

    await veilleur.reconcilier();

    assert.equal(monde.canalNomme('essai-orphelin').is_archived, true, 'une ligne jetable s’archive au balayage');
  });
});

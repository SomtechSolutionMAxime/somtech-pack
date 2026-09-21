// la-sonde-du-veilleur-mesure-le-vrai-socket.test.js — T-20260914-0004.
//
// Les bancs voisins (`la-panne-du-veilleur-nest-pas-une-ligne-absente.test.js`) injectent le
// CODE directement, par un double qui lève une erreur toute faite. Celui-ci ferme la boucle :
// il prouve que le code `VEILLEUR_MUET` est bien posé sur le CHEMIN RÉEL — un vrai socket UNIX,
// un vrai `net.createServer`, un vrai `parler()` de `ligne-directe/src/client.js` — et pas
// seulement sur le constructeur `refusSansReponse` appelé en direct.
//
// ⚠️ AUCUN VRAI VEILLEUR NE NAÎT ICI. Le double socket est un `net.createServer` nu, jamais
// `Veilleur.demarrer` ni le vrai service : on ne touche à aucune écoute Slack, à aucun
// `~/.somtech` (`LIGNE_DIRECTE_RACINE` n'est jamais lu ici — le chemin du socket est passé
// explicitement à `parler()`).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { parler } from '../../ligne-directe/src/client.js';
import { traiterRequete } from '../src/hook.js';

/** Le lieu d'un représentant, jetable — la garde ne s'applique que dans un lieu d'agent. */
function lieuTemp() {
  const d = mkdtempSync(join(tmpdir(), 'smtk-sonde-lieu-'));
  writeFileSync(join(d, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
  writeFileSync(join(d, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
  writeFileSync(join(d, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
  mkdirSync(join(d, '.claude'), { recursive: true });
  writeFileSync(join(d, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');
  return d;
}

/** Tout serveur d'essai né ici — fermé même si un test échoue. */
const aFermer = [];
after(async () => {
  await Promise.all(aFermer.map((srv) => new Promise((r) => srv.close(() => r()))));
});

/**
 * Un serveur JETABLE qui parle le protocole réel de `client.js` — une ligne JSON par
 * requête, une ligne JSON par réponse. `gestionnaire` décide QUOI répondre ; ne rien
 * répondre reproduit exactement un veilleur MUET : la connexion est acceptée, rien ne suit.
 */
function serveurDessai(cheminSocket, gestionnaire) {
  return new Promise((resolve, reject) => {
    const srv = createServer((socket) => {
      let tampon = '';
      socket.on('data', (m) => {
        tampon += m.toString('utf8');
        const coupure = tampon.indexOf('\n');
        if (coupure === -1) return;
        const requete = JSON.parse(tampon.slice(0, coupure));
        tampon = tampon.slice(coupure + 1);
        gestionnaire(requete, socket);
      });
      socket.on('error', () => {});
    });
    aFermer.push(srv);
    srv.on('error', reject);
    srv.listen(cheminSocket, () => resolve(srv));
  });
}

test(
  'un veilleur qui ACCEPTE la connexion mais ne répond JAMAIS porte VEILLEUR_MUET — sur le vrai transport',
  { timeout: 10_000 },
  async () => {
    const racine = mkdtempSync(join(tmpdir(), 'smtk-sonde-muet-'));
    const cheminSocket = join(racine, 'veilleur.sock');
    try {
      // Ne répond RIEN, jamais — le veilleur muet exact que `VEILLEUR_MUET` nomme.
      await serveurDessai(cheminSocket, () => {});

      await assert.rejects(
        () =>
          parler(
            { geste: 'etat' },
            {
              cheminSocket,
              reveiller: false,
              sonde: { intervalle: 100, borne: 200 },
              bornesParGeste: { etat: 1500 },
            }
          ),
        (err) => {
          assert.equal(err.code, 'VEILLEUR_MUET', `code reçu : ${err.code} — message : ${err.message}`);
          return true;
        }
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  }
);

test('un veilleur qui répond au ping ET au geste ne lève AUCUNE erreur — même transport, mêmes options', async () => {
  const racine = mkdtempSync(join(tmpdir(), 'smtk-sonde-sain-'));
  const cheminSocket = join(racine, 'veilleur.sock');
  try {
    await serveurDessai(cheminSocket, (requete, socket) => {
      if (requete.geste === 'ping') socket.write(`${JSON.stringify({ ok: true })}\n`);
      else if (requete.geste === 'etat') socket.write(`${JSON.stringify({ ok: true, ouvertes: [] })}\n`);
    });

    const reponse = await parler(
      { geste: 'etat' },
      {
        cheminSocket,
        reveiller: false,
        sonde: { intervalle: 100, borne: 200 },
        bornesParGeste: { etat: 1500 },
      }
    );
    assert.deepEqual(reponse, { ok: true, ouvertes: [] });
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// SOCKET ABSENT : LE VRAI CHEMIN REND BIEN `ENOENT`, ET LA GARDE LE CLASSE « VEILLEUR »
//
// ⚠️ ANGLE MORT NOMMÉ PAR LA PASSE PORTAIL DU TROISIÈME TOUR, et il était juste : `ENOENT`
// figure dans la liste des codes de panne du veilleur (`hook.js`), mais aucun banc ne
// l'obtenait du VRAI chemin. Il n'était éprouvé que par des doubles qui posaient le code à la
// main — c'est-à-dire qu'on éprouvait notre propre hypothèse sur ce que `client.js` rend.
//
// Le fait à tenir : un socket ABSENT est le cas le plus ordinaire du parc (veilleur jamais
// né, ou sa place retirée), et c'est aussi le plus facile à reclasser par erreur — `ENOENT`
// est le même code que celui d'un binaire introuvable, que la garde doit au contraire classer
// « cause inconnue » (banc voisin : un-outil-introuvable-nest-pas-un-veilleur-en-panne).
// Les deux ENOENT ne doivent donc PAS finir au même endroit, et seul un ENOENT VENU DU VRAI
// SOCKET prouve que celui-là tombe du bon côté.
test('socket ABSENT sur le vrai chemin → ENOENT, et la garde en fait une panne de VEILLEUR (lecture permise)', async () => {
  const bac = mkdtempSync(join(tmpdir(), 'smtk-socket-absent-'));
  const cheminSocket = join(bac, 'veilleur.sock'); // jamais créé — la place n'existe pas

  // ① LE VRAI CLIENT, sur un chemin sans socket. `reveiller: false` : on mesure l'absence,
  // on ne fait naître aucun veilleur (le poste partagé n'est jamais approché).
  let codeMesure = null;
  try {
    await parler({ geste: 'etat' }, { reveiller: false, cheminSocket });
    assert.fail('un socket absent ne peut pas rendre une réponse');
  } catch (err) {
    codeMesure = err.code;
  }
  assert.equal(codeMesure, 'ENOENT', `le vrai chemin doit rendre ENOENT — reçu : ${codeMesure}`);

  // ② LA GARDE, nourrie d'une erreur PORTANT CE CODE MESURÉ (et non un code écrit à la main) :
  // elle doit ouvrir la lecture, comme pour toute panne du veilleur.
  const lieu = lieuTemp();
  try {
    const double = async () => {
      throw Object.assign(new Error(`connect ENOENT ${cheminSocket}`), { code: codeMesure });
    };
    const lecture = await traiterRequete({ cwd: lieu, tool_name: 'Grep', tool_input: { pattern: 'x' } }, double);
    assert.equal(lecture.permissionDecision, 'allow', `la lecture doit passer — reçu : ${lecture.permissionDecisionReason}`);

    const ecriture = await traiterRequete({ cwd: lieu, tool_name: 'Write', tool_input: { file_path: 'x' } }, double);
    assert.equal(ecriture.permissionDecision, 'deny', 'écrire reste refusé : la polarité de panne ne bouge pas');
    assert.doesNotMatch(
      ecriture.permissionDecisionReason,
      /il te manque|n’ouvre aucune de tes lignes/,
      `un socket absent n'est pas une ligne jamais ouverte — reçu : ${ecriture.permissionDecisionReason}`
    );
  } finally {
    rmSync(lieu, { recursive: true, force: true });
  }
  rmSync(bac, { recursive: true, force: true });
});

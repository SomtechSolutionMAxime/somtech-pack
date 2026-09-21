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
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { parler } from '../../ligne-directe/src/client.js';

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

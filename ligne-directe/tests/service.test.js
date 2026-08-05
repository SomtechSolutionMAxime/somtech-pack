// Le veilleur comme service du poste — et le piège qui vient avec.
//
// Deux façons de naître coexistent désormais : le démarrage paresseux (un agent ouvre sa
// ligne) et le service du poste (à l'ouverture de session). Sans verrou, les deux peuvent
// vivre en même temps — DEUX connexions d'écoute, donc chaque parole du dirigeant remise
// EN DOUBLE dans le pane de l'agent. C'est le défaut que ce fichier surveille.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

let Veilleur, construirePlist, ETIQUETTE, sauverRegistre;
let racine;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-service-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ construirePlist, ETIQUETTE } = await import('../src/service.js'));
  ({ sauverRegistre } = await import('../src/registre.js'));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [] }));

/** Un faux veilleur qui répond au ping, comme le vrai. */
function veilleurFactice(chemin, { repond = true } = {}) {
  return new Promise((resolve) => {
    const serveur = createServer((flux) => {
      flux.on('data', () => {
        if (repond) flux.write(`${JSON.stringify({ ok: true, veilleur: 'vivant' })}\n`);
      });
    });
    serveur.listen(chemin, () => resolve(serveur));
  });
}

test('UN SECOND VEILLEUR RENONCE quand un premier tient déjà le socket', async () => {
  const chemin = join(racine, 'occupe.sock');
  const serveur = await veilleurFactice(chemin);
  try {
    assert.equal(await Veilleur.dejaVivant(chemin), true);
    await assert.rejects(
      () => Veilleur.demarrer({ cheminSocket: chemin }),
      (err) => {
        // Le code compte autant que le refus : c'est lui qui dit au point d'entrée de
        // sortir en 0 — une sortie en erreur ferait relancer le service en boucle.
        assert.equal(err.code, 'DEJA_VIVANT');
        return true;
      }
    );
  } finally {
    serveur.close();
  }
});

test('UN SOCKET ORPHELIN ne bloque pas un veilleur neuf', async () => {
  // Un veilleur tué laisse son fichier de socket derrière lui. Se fier à sa PRÉSENCE
  // condamnerait le poste : plus jamais de veilleur jusqu'à un ménage manuel.
  const chemin = join(racine, 'orphelin.sock');
  writeFileSync(chemin, '');
  assert.equal(await Veilleur.dejaVivant(chemin), false);
});

test('un socket qui ne répond pas est traité comme libre, pas comme occupé', async () => {
  const chemin = join(racine, 'muet.sock');
  const serveur = await veilleurFactice(chemin, { repond: false });
  try {
    assert.equal(await Veilleur.dejaVivant(chemin), false);
  } finally {
    serveur.close();
  }
});

test('aucun socket du tout : la place est libre', async () => {
  assert.equal(await Veilleur.dejaVivant(join(racine, 'jamais-cree.sock')), false);
});

test('le service décrit revient au démarrage et se relance s’il tombe', () => {
  const plist = construirePlist({ node: '/usr/bin/node', script: '/x/demarrer.js', path: '/opt/homebrew/bin:/usr/bin' });

  assert.match(plist, new RegExp(`<string>${ETIQUETTE}</string>`));
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/, 'sans RunAtLoad, le veilleur ne revient pas après un redémarrage');
  assert.match(plist, /<key>KeepAlive<\/key>/, 'sans KeepAlive, un veilleur qui tombe ne revient jamais');
});

test('le service NE relance PAS un veilleur qui s’est retiré proprement', () => {
  // KeepAlive inconditionnel + verrou d'unicité = boucle infinie de démarrages avortés,
  // trente fois par minute, dans le journal du poste.
  const plist = construirePlist();
  assert.match(plist, /<key>SuccessfulExit<\/key>\s*<false\/>/);
  assert.match(plist, /<key>ThrottleInterval<\/key><integer>30<\/integer>/);
});

test('le service porte son PATH — un service ne charge aucun profil de shell', () => {
  // La panne classique : tout marche à la main, rien ne marche au démarrage, parce que le
  // veilleur ne trouve pas `herdr`.
  const plist = construirePlist({ path: '/opt/homebrew/bin:/usr/bin' });
  assert.match(plist, /<key>PATH<\/key><string>\/opt\/homebrew\/bin:\/usr\/bin<\/string>/);
});

test('les chemins à caractères spéciaux ne cassent pas le descripteur', () => {
  const plist = construirePlist({ script: '/Users/x/Mon <dossier> & co/demarrer.js' });
  assert.match(plist, /Mon &lt;dossier&gt; &amp; co/);
  assert.doesNotMatch(plist, /<dossier>/);
});

test('DEUX VEILLEURS QUI NAISSENT EN MÊME TEMPS : un seul prend la place', async () => {
  // Le cas réel, mesuré : le service du poste et un démarrage paresseux lancés à 200 ms
  // d'écart. Le sondage préalable les déclarait tous deux « place libre » — parce que le
  // premier était encore en train de lire le trousseau. Deux connexions d'écoute, chaque
  // message du dirigeant remis EN DOUBLE. Le verrou doit donc être la création du socket
  // elle-même (atomique), pas un sondage.
  const chemin = join(racine, 'course.sock');
  const a = new Veilleur({ cheminSocket: chemin, identite: { equipe: 'T' } });
  const b = new Veilleur({ cheminSocket: chemin, identite: { equipe: 'T' } });

  const resultats = await Promise.allSettled([a.ecouterLocal(), b.ecouterLocal()]);
  try {
    const tenus = resultats.filter((r) => r.status === 'fulfilled');
    const ecartes = resultats.filter((r) => r.status === 'rejected');
    assert.equal(tenus.length, 1, 'un seul veilleur doit tenir le socket');
    assert.equal(ecartes.length, 1);
    assert.equal(ecartes[0].reason.code, 'DEJA_VIVANT', 'le perdant doit se retirer proprement, pas planter');
  } finally {
    await a.arreter().catch(() => {});
    await b.arreter().catch(() => {});
  }
});

test('un socket ORPHELIN est repris — sinon le poste reste sans veilleur jusqu’à un ménage manuel', async () => {
  const chemin = join(racine, 'reprise.sock');
  const mort = await veilleurFactice(chemin, { repond: false });
  mort.close();
  // Le fichier survit à la fermeture : c'est exactement ce que laisse un veilleur tué.
  const { writeFileSync: ecrire } = await import('node:fs');
  ecrire(chemin, '');

  const neuf = new Veilleur({ cheminSocket: chemin, identite: { equipe: 'T' } });
  await neuf.ecouterLocal();
  try {
    assert.equal(await Veilleur.dejaVivant(chemin), true, 'le veilleur neuf doit désormais répondre à sa place');
  } finally {
    await neuf.arreter();
  }
});

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

import { aucunGesteQuiDetruit } from './aide/gestes-qui-detruisent.js';

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

// —————————————————————————————————————————————————————————————————————————————————
// Le chien de garde de l'écoute.
//
// Défaut RÉEL, constaté en usage : la connexion d'écoute est tombée et n'est jamais
// revenue. Le veilleur tournait, répondait aux commandes locales, et n'écoutait plus rien —
// le dirigeant a écrit, rien n'est arrivé, et rien ne le lui a dit. Sur un portable, la
// connexion meurt à moitié (veille, changement de réseau) sans qu'aucun événement de
// fermeture ne soit émis : attendre qu'on nous prévienne ne suffit pas.

test('LE CHIEN DE GARDE RÉTABLIT une écoute morte sans événement de fermeture', async () => {
  const v = new Veilleur({ cheminSocket: join(racine, 'garde.sock'), identite: { equipe: 'T' } });
  let tentatives = 0;
  v.connecterSlack = () => {
    tentatives += 1;
  };
  // Une connexion morte à MOITIÉ : l'objet existe, mais il n'écoute plus. Aucun événement
  // n'a été émis — c'est précisément le cas que l'écoute d'un `close` ne couvre pas.
  v.ws = { readyState: 3 }; // CLOSED, selon la norme WebSocket

  const minuteur = v.surveiller(20);
  await new Promise((r) => setTimeout(r, 70));
  clearInterval(minuteur);

  assert.ok(tentatives >= 2, `le chien de garde doit rétablir (${tentatives} tentative(s))`);
});

test('le chien de garde NE RECONNECTE PAS quand l’écoute est vivante', async () => {
  const v = new Veilleur({ cheminSocket: join(racine, 'garde2.sock'), identite: { equipe: 'T' } });
  let tentatives = 0;
  v.connecterSlack = () => {
    tentatives += 1;
  };
  v.ws = { readyState: 1 }; // OPEN

  const minuteur = v.surveiller(20);
  await new Promise((r) => setTimeout(r, 70));
  clearInterval(minuteur);

  assert.equal(tentatives, 0, 'reconnecter une écoute vivante empilerait deux connexions');
});

test('une connexion EN COURS d’établissement est laissée tranquille', async () => {
  const v = new Veilleur({ cheminSocket: join(racine, 'garde3.sock'), identite: { equipe: 'T' } });
  let tentatives = 0;
  v.connecterSlack = () => {
    tentatives += 1;
  };
  v.ws = { readyState: 0 }; // CONNECTING

  const minuteur = v.surveiller(20);
  await new Promise((r) => setTimeout(r, 70));
  clearInterval(minuteur);

  assert.equal(tentatives, 0, "sans quoi le chien de garde relancerait par-dessus chaque tentative en cours");
});

test("L'ORDRE DES GARDE-FOUS : place occupée l'emporte sur toute autre plainte", async () => {
  // Trouvé par la CI. La vérification de version Node était passée en tête de `demarrer` :
  // sur un Node ancien, un veilleur qui trouvait la place occupée se plaignait de sa
  // version au lieu de se retirer proprement — et le gestionnaire de services, voyant une
  // erreur, le relançait en boucle. Le verrou d'unicité prime sur tout le reste.
  const chemin = join(racine, 'ordre.sock');
  const serveur = await veilleurFactice(chemin);
  const vraiWS = globalThis.WebSocket;
  globalThis.WebSocket = undefined; // on se met dans la peau d'un Node antérieur à 22
  try {
    await assert.rejects(
      () => Veilleur.demarrer({ cheminSocket: chemin }),
      (err) => {
        assert.equal(err.code, 'DEJA_VIVANT', `attendu DEJA_VIVANT, reçu : ${err.message}`);
        return true;
      }
    );
  } finally {
    globalThis.WebSocket = vraiWS;
    serveur.close();
  }
});

// —————————————————————————————————————————————————————————————————————————————————
// Passer la main.
//
// Défaut trouvé en usage, et le plus sournois de la journée : le verrou d'unicité protège
// des remises en double, mais il INTERDIT du même coup toute mise à jour. Le veilleur neuf
// trouve la place occupée, se retire poliment — et la version fraîchement publiée reste
// sans effet. Tout a l'air installé, rien ne l'est, et rien ne le signale.

test('LE VEILLEUR SAIT CÉDER LA PLACE — sinon aucune mise à jour ne prend jamais effet', async () => {
  const v = new Veilleur({ cheminSocket: join(racine, 'ceder.sock'), identite: { equipe: 'T' } });
  await v.ecouterLocal();
  try {
    const r = await v.traiterGeste({ geste: 'ceder' });
    assert.equal(r.ok, true);
    assert.equal(r.cede, true, 'le geste doit exister et confirmer, sinon il faut tuer un processus à la main');
  } finally {
    await v.arreter().catch(() => {});
  }
});

test('céder répond AVANT de se retirer — sinon l’appelant ne sait pas si ça a marché', async () => {
  // Le retrait est différé : la réponse doit partir d'abord. Un veilleur qui se couperait
  // la parole laisserait l'appelant sur une erreur de connexion, incapable de distinguer
  // « il a cédé » de « il est mort ».
  const v = new Veilleur({ cheminSocket: join(racine, 'ceder2.sock'), identite: { equipe: 'T' } });
  await v.ecouterLocal();
  try {
    const { demander } = await import('../src/client.js');
    const r = await demander({ geste: 'ceder' }, join(racine, 'ceder2.sock'), { delai: 2000 });
    assert.equal(r.ok, true);
  } finally {
    await v.arreter().catch(() => {});
  }
});

test('UNE RELÈVE QUI N’A PAS EU LIEU ÉCHOUE — elle ne se déclare pas réussie', async () => {
  // Trouvé sur mon propre correctif, une heure après l'avoir écrit : un veilleur d'une
  // version antérieure ne connaît pas le geste, il refuse et garde la place — et la relève
  // rendait « ok » quand même. Un faux succès sur le geste censé réparer les faux succès.
  const chemin = join(racine, 'tetu.sock');
  const { createServer: creer } = await import('node:net');
  // Un veilleur têtu : il répond à tout, il ne cède jamais, il ne meurt pas.
  const tetu = await new Promise((resolve) => {
    const srv = creer((flux) => {
      flux.on('data', (m) => {
        const geste = JSON.parse(m.toString().trim()).geste;
        flux.write(`${JSON.stringify(geste === 'ceder' ? { ok: false, erreur: 'geste inconnu : ceder' } : { ok: true })}\n`);
      });
    });
    srv.listen(chemin, () => resolve(srv));
  });

  const { passerLaMain } = await import('../src/client.js');
  try {
    await assert.rejects(() => passerLaMain({ cheminSocket: chemin }), (err) => {
      assert.match(err.message, /n'a pas cédé/);
      // Et l'erreur doit dire QUOI FAIRE, pas seulement que ça a raté.
      //
      // Cette ligne exigeait `pkill` — c'est-à-dire qu'elle ANCRAIT un geste qui frappe par
      // motif, et qui tuait donc tous les veilleurs du poste (T-20260811-0087). Ce qu'on veut
      // vraiment est plus fort qu'un mot : le geste proposé doit VISER LA PLACE OCCUPÉE, et
      // le seul moyen de le prouver est qu'il porte le chemin du socket en cause — ce qu'un
      // motif global ne peut pas faire.
      assert.ok(err.message.includes(chemin), `le geste proposé doit viser CETTE place — reçu :\n${err.message}`);
      aucunGesteQuiDetruit(assert, err.message, 'veilleur qui ne cède pas');
      return true;
    });
  } finally {
    tetu.close();
  }
});

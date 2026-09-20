// UN VEILLEUR MUET N'EST PAS UNE PLACE LIBRE (T-20260825-0101).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI A ÉTÉ MESURÉ SUR LE POSTE, LE 2026-08-25
//
//   pgrep -f demarrer-veilleur.js | wc -l   → 2
//   lsof -t ~/.somtech/ligne-directe/veilleur.sock → 22215 et 67661
//   22215 né le 25 août 18:18 (la relève de l'instant) ; 67661 né le 24 août 13:58, vieux
//   d'un jour, sourd au geste `ceder`.
//
// Et `passerLaMain()` avait rendu `{"ok":true,"ancien_cede":true}`. Deux écoutes Slack
// vivantes, donc CHAQUE PAROLE DU DIRIGEANT REMISE EN DOUBLE — pendant qu'un geste appelé
// exprès pour garantir l'unicité disait que tout allait bien.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE MÉCANISME — DEUX FOIS LA MÊME MÉPRISE, À DEUX ENDROITS
//
// « MUET » ET « MORT » RENDAIENT LE MÊME VERDICT. `Veilleur.dejaVivant()` sonde avec un
// `ping` borné à 2 s et rend `false` sur TOUT échec — socket absent, connexion refusée, ou
// simplement pas de réponse à temps. Or un veilleur dont la boucle d'événements est occupée
// (une requête Slack lente, une vue du parc qui prend 67 s — mesuré) tient toujours sa
// place et son écoute : il est vivant, il ne répond pas. Le second le déclarait orphelin,
// **effaçait le socket** et prenait le chemin. Le premier survivait avec son ancien inode et
// sa connexion Slack. Deux veilleurs.
//
//   • `veilleur.js` / `ecouterLocal()` en décidait l'EFFACEMENT du socket ;
//   • `client.js`   / `passerLaMain()` en décidait « la place est libre ».
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE BANC REPRODUIT — LA CAUSE, PAS L'ÉTAT FINAL
//
// On ne fabrique pas deux veilleurs à la main pour constater qu'il y en a deux : on
// reproduit la CAUSE avec UNE SEULE substitution nommée — le veilleur en place ne rend plus
// ses réponses (`traiterGeste` qui ne rend jamais) — et on regarde ce que le second en
// conclut. Tout le reste est le vrai code : le vrai serveur, la vraie prise de socket, le
// vrai `EADDRINUSE`.
//
// ⚠️ AUCUN VEILLEUR D'ESSAI NE SURVIT À CE FICHIER. C'est le défaut qu'on répare : les
// occupants d'essai sont des processus jetables (jamais `demarrer-veilleur.js`), inscrits
// dès leur naissance et tués dans un `after` qui s'exécute même sur échec.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { aucunGesteQuiDetruit } from './aide/gestes-qui-detruisent.js';

let Veilleur, passerLaMain, placeTenue;
// ÉTAT D'UNE PROMESSE, SANS JAMAIS REGARDER L'HORLOGE (T-20260920-0013).
//
// Dire « elle n'a pas encore tranché » demandait jusqu'ici d'attendre un délai et de
// constater qu'il s'était écoulé — c'est-à-dire de mesurer la machine. Ici on ne mesure
// rien : on fait COURIR la promesse contre une promesse déjà résolue. L'ordre des
// microtâches est déterministe, il ne dépend ni de la charge ni du runner. Si la promesse
// avait déjà tranché, son résultat gagne la course ; si elle attend, c'est le témoin qui
// gagne.
//
// ⚠️ LES TOURS À VIDE NE SONT PAS UNE ATTENTE DÉGUISÉE. Ils laissent s'écouler les
// microtâches déjà en file — un `.then()` interne, un `await` d'un tour précédent — pour
// que la course lise un état stabilisé et non un état en train de se faire. Aucun `setTimeout`,
// aucune durée : quel que soit le runner, le nombre de tours est le même.
const TEMOIN_EN_ATTENTE = Symbol('en attente');
async function etatDe(promesse) {
  for (let i = 0; i < 16; i += 1) await Promise.resolve();
  const gagnant = await Promise.race([promesse, Promise.resolve(TEMOIN_EN_ATTENTE)]);
  return gagnant === TEMOIN_EN_ATTENTE ? 'en attente' : 'tranchée';
}

let racine;
let compteur = 0;

/** Tout ce qui a été mis au monde ici — tué dans `after`, quoi qu'il arrive. */
const occupantsDessai = new Set();

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-unicite-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ passerLaMain, placeTenue } = await import('../src/client.js'));
});

after(() => {
  for (const enfant of occupantsDessai) {
    try {
      enfant.kill('SIGKILL');
    } catch {
      /* déjà parti */
    }
  }
  rmSync(racine, { recursive: true, force: true });
});

const chemin = (quoi) => join(racine, `${quoi}-${(compteur += 1)}.sock`);

/**
 * Un occupant JETABLE de la place — un processus à part, comme dans la vraie vie, mais qui
 * ne sait rien faire d'autre que tenir un socket. Jamais `demarrer-veilleur.js` : un banc
 * qui ferait naître un vrai veilleur ouvrirait une écoute Slack de plus, c'est-à-dire
 * exactement le défaut qu'il prétend éprouver.
 */
function tenirLaPlace(chemin, { repond = false } = {}) {
  const code = `
    const net = require('node:net');
    const repond = ${repond ? 'true' : 'false'};
    const srv = net.createServer((f) => {
      f.on('error', () => {});
      if (repond) f.on('data', () => f.write(JSON.stringify({ ok: true }) + '\\n'));
    });
    srv.listen(process.argv[1], () => process.stdout.write('PRET\\n'));
    setInterval(() => {}, 1 << 30);
  `;
  const enfant = spawn(process.execPath, ['-e', code, chemin], { stdio: ['ignore', 'pipe', 'ignore'] });
  occupantsDessai.add(enfant);
  return new Promise((resolve, reject) => {
    enfant.stdout.on('data', (m) => {
      if (m.toString().includes('PRET')) resolve(enfant);
    });
    enfant.on('exit', (c) => reject(new Error(`l'occupant d'essai est mort avant d'être prêt (${c})`)));
    setTimeout(() => reject(new Error("l'occupant d'essai n'a jamais dit PRET")), 5000).unref?.();
  });
}

/** Tue un occupant et attend sa mort — sinon la mesure suivante porte sur un vivant. */
function tuer(enfant) {
  return new Promise((resolve) => {
    if (enfant.exitCode !== null || enfant.signalCode !== null) return resolve();
    enfant.on('exit', resolve);
    enfant.kill('SIGKILL');
  });
}

// —————————————————————————————————————————————————————————————————————————— la cause

test('UN VEILLEUR VIVANT MAIS MUET N’EST PAS UN SOCKET ORPHELIN — le second se retire', async () => {
  const place = chemin('muet');
  const a = new Veilleur({ cheminSocket: place, identite: { equipe: 'T' } });
  await a.ecouterLocal();

  // ⚠️ LA SUBSTITUTION, ET IL N'Y EN A QU'UNE. Le veilleur en place reste vivant, garde son
  // socket, garde son écoute — il ne rend simplement plus ses réponses. C'est l'état d'une
  // boucle d'événements occupée, mesuré en usage : `vue` a pendu 67 s au socket du poste.
  a.traiterGeste = () => new Promise(() => {});

  const b = new Veilleur({ cheminSocket: place, identite: { equipe: 'T' } });
  try {
    // ⚠️ ON MESURE L'ÉTAT AVANT DE JUGER LE REFUS. Exiger d'abord le rejet ferait rougir sur
    // « rejet manquant » — vrai, mais muet sur ce que ça coûte. Le fait qui compte est le
    // NOMBRE D'ÉCOUTES VIVANTES : c'est lui qui se paie en paroles remises en double.
    const issue = await b.ecouterLocal().then(
      () => null,
      (err) => err
    );

    const ecoutes = [a, b].filter((v) => v.serveur?.listening).length;
    assert.equal(ecoutes, 1, `UNE SEULE écoute doit survivre — ${ecoutes} vivantes, donc chaque parole du dirigeant remise en double`);
    assert.ok(existsSync(place), 'le socket du veilleur en place ne doit pas avoir été effacé sous ses pieds');

    assert.ok(issue, 'le second doit se retirer, pas s’installer par-dessus');
    assert.equal(issue.code, 'DEJA_VIVANT', `le retrait doit être PROPRE, pas un plantage — reçu : ${issue.message}`);
    // Et le motif doit être CELUI-LÀ, pas « il m'a répondu » : c'est la branche qui
    // manquait. Sans ça, la garde pourrait être verte parce que le sondage aurait
    // répondu — ce qu'il ne fait pas ici, par construction.
    assert.match(issue.message, /sans répondre/, `le retrait doit nommer son motif — reçu : ${issue.message}`);
  } finally {
    await b.arreter().catch(() => {});
    a.traiterGeste = () => Promise.resolve({ ok: true });
    await a.arreter().catch(() => {});
  }
});

test('LA SONDE DE PRISE TOUCHE VRAIMENT LA PLACE — vrai sur un socket tenu, faux sur rien', async () => {
  // Sans cette paire, la garde du dessus pourrait être verte parce que la sonde répond
  // « tenue » à tout le monde — y compris là où il n'y a rien. Les deux sens comptent.
  const place = chemin('sonde');
  const occupant = await tenirLaPlace(place);
  try {
    assert.equal(await Veilleur.placeTenue(place), true, 'un socket tenu par un processus vivant est TENU');
  } finally {
    await tuer(occupant);
  }
  assert.equal(await Veilleur.placeTenue(join(racine, 'jamais-cree.sock')), false, 'là où il n’y a rien, la place est libre');
});

test('UN VRAI SOCKET ORPHELIN — processus tué, fichier resté — EST REPRIS', async () => {
  // LE SYMÉTRIQUE, et il compte autant. Un correctif qui refuserait toujours de reprendre
  // la place passerait la garde du dessus et condamnerait le poste : plus jamais de
  // veilleur jusqu'à un ménage à la main. On tue donc un occupant POUR DE VRAI (SIGKILL,
  // sans lui laisser effacer son socket) et on exige que le neuf s'installe.
  const place = chemin('orphelin');
  const mort = await tenirLaPlace(place);
  await tuer(mort);
  assert.ok(existsSync(place) && statSync(place).isSocket(), 'le fichier de socket doit survivre à son processus');

  const neuf = new Veilleur({ cheminSocket: place, identite: { equipe: 'T' } });
  await neuf.ecouterLocal();
  try {
    assert.equal(await Veilleur.dejaVivant(place), true, 'le veilleur neuf doit répondre à sa place');
  } finally {
    await neuf.arreter().catch(() => {});
  }
});

// ————————————————————————————————————————————————————————————————— passer la main

test('UNE PLACE TENUE PAR UN MUET NE SE DÉCLARE PAS LIBRE — la relève échoue plutôt que de mentir', async () => {
  const place = chemin('releve-muette');
  const tetuMuet = await tenirLaPlace(place); // il ne répond ni au `ceder`, ni au `ping`
  let neQuiSontNes = 0;
  try {
    await assert.rejects(
      () => passerLaMain({ cheminSocket: place, reveiller: () => (neQuiSontNes += 1) }),
      (err) => {
        assert.match(err.message, /n'a pas cédé/, `le refus doit dire ce qui n'a pas eu lieu — reçu : ${err.message}`);
        assert.ok(err.message.includes(place), 'le refus doit viser CETTE place');
        // ⚠️ ET IL DOIT NOMMER L'OCCUPANT, pas envoyer le chercher. Le pid a été mesuré une
        // seconde plus tôt : le taire fait refaire le travail à la main, et c'est pendant ce
        // travail-là qu'on tape `pkill` par lassitude (T-20260811-0087).
        assert.ok(
          err.message.includes(String(tetuMuet.pid)),
          `le refus doit NOMMER qui tient la place (${tetuMuet.pid}) — reçu :\n${err.message}`
        );
        aucunGesteQuiDetruit(assert, err.message, 'relève sur une place tenue par un muet');
        return true;
      }
    );
    assert.equal(neQuiSontNes, 0, 'on ne fait pas naître un veilleur par-dessus une place encore tenue');
  } finally {
    await tuer(tetuMuet);
  }
});

test('DEUX OCCUPANTS APRÈS LA RELÈVE : elle le DIT et les nomme, elle ne rend pas « ok »', async () => {
  // L'ÉTAT MESURÉ SUR LE POSTE, reconstitué à l'identique : un revenant tient encore le nom
  // du socket alors que le chemin a été effacé sous lui (c'est ce que faisait l'ancien
  // `ecouterLocal`), et un veilleur neuf reprend le chemin. `lsof -t` rend LES DEUX —
  // vérifié : sur macOS il apparie par NOM, pas par inode.
  const place = chemin('deux-occupants');
  const revenant = await tenirLaPlace(place);
  rmSync(place, { force: true }); // l'effacement fautif d'hier : le revenant devient invisible au chemin

  let neuf = null;
  try {
    await assert.rejects(
      () =>
        passerLaMain({
          cheminSocket: place,
          reveiller: () => {
            tenirLaPlace(place, { repond: true }).then((e) => {
              neuf = e;
            });
          },
        }),
      (err) => {
        assert.match(err.message, /occupant/i, `le refus doit parler des occupants — reçu : ${err.message}`);
        assert.ok(
          err.message.includes(String(revenant.pid)),
          `le refus doit NOMMER le revenant (${revenant.pid}) — sinon il faut le chercher à la main :\n${err.message}`
        );
        aucunGesteQuiDetruit(assert, err.message, 'relève avec deux occupants');
        return true;
      }
    );
  } finally {
    await tuer(revenant);
    if (neuf) await tuer(neuf);
  }
});

test('UNE RELÈVE SAINE REND LE COMPTE QU’ELLE A MESURÉ — un occupant, nommé', async () => {
  // Sans cette garde, un compte qui rendrait toujours « je n'ai pas pu mesurer » passerait
  // les deux gardes voisines sans jamais compter quoi que ce soit.
  const place = chemin('releve-saine');
  let neuf = null;
  try {
    const r = await passerLaMain({
      cheminSocket: place,
      reveiller: () => {
        tenirLaPlace(place, { repond: true }).then((e) => {
          neuf = e;
        });
      },
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.occupants, [neuf.pid], 'la relève doit rendre le seul occupant qu’elle a compté');
  } finally {
    if (neuf) await tuer(neuf);
  }
});

test('QUAND LE COMPTE EST IMPOSSIBLE, LA RELÈVE LE DIT — elle n’invente ni « un seul », ni un refus', async () => {
  // ⚠️ « AUCUN OCCUPANT » ET « JE N'AI PAS PU COMPTER » NE SONT PAS LE MÊME FAIT. Refuser
  // toute relève sur un poste sans `lsof` échangerait un double contre une capacité morte ;
  // rendre « ok, un seul » sans avoir compté serait le mensonge qu'on répare. On rend donc
  // le compte à `null` — dit, pas deviné.
  const place = chemin('sans-lsof');
  const cheminReel = process.env.PATH;
  let neuf = null;
  try {
    process.env.PATH = ''; // l'outil qui compte devient introuvable — panne de mesure, pas absence
    const r = await passerLaMain({
      cheminSocket: place,
      reveiller: () => {
        tenirLaPlace(place, { repond: true }).then((e) => {
          neuf = e;
        });
      },
    });
    assert.equal(r.ok, true, 'une relève qui a bien eu lieu ne se refuse pas parce qu’on n’a pas su compter');
    assert.equal(r.occupants, null, 'le compte non mesuré se rend NUL, jamais comme un compte');
  } finally {
    process.env.PATH = cheminReel;
    if (neuf) await tuer(neuf);
  }
});

test('UNE PRISE QUI NE CONCLUT JAMAIS : la sonde REND quand même, elle rend « tenue », et c’est LE MINUTEUR qui a tranché', { timeout: 5000 }, async () => {
  // ⚠️ CE BANC FERME UNE ISSUE, IL NE REJOUE PAS LA CHAÎNE. Substituer le TEMPS ne marche
  // pas : mesuré, la prise tranche 30 fois sur 30 avant le minuteur, même réglé à zéro — un
  // banc qui baisserait la borne serait vert sans jamais toucher la branche qu'il prétend
  // éprouver. On substitue donc DEUX points nommés — le transport de la prise, et le
  // minuteur — et la seule issue restante devient celle qu'on observe.
  //
  // 🔴 CE BANC NE MESURE PLUS AUCUNE DURÉE, ET C'EST TOUT SON OBJET (T-20260920-0013).
  // Il comparait `Date.now()` à la borne pour prouver que le verdict venait du minuteur :
  // `rendu en 59 ms pour une borne de 60 ms`. Une milliseconde de dérive sur un runner
  // chargé, et il rougissait. QUATRE fois sur TROIS lots — dont deux fois sur un lot qui ne
  // touchait que des fichiers markdown, où aucun chemin ne mène à un minuteur. Vert au rejeu
  // du même job à chaque fois, sans rien changer.
  //
  // > Une garde qui COMPTE mesure la machine autant que le code, et son rouge accuse le
  // > code en parlant du runner.
  //
  // ⚠️ ÉLARGIR LA BORNE (60 → 200 ms) AURAIT ÉTÉ LE PIÈGE : vert, et toujours en train de
  // mesurer la machine, seulement plus lentement. Le discriminant n'est donc plus un temps,
  // c'est UN APPEL : le minuteur est injecté, le banc observe qu'il a été planifié avec la
  // borne, que la promesse reste EN ATTENTE tant que personne ne le déclenche, et que c'est
  // son déclenchement — le sien, provoqué à la main — qui tranche.
  //
  // ⚠️ ET LE MINUTEUR NE PEUT PAS ÊTRE SUPPRIMÉ POUR AUTANT : sans lui, si ni la prise ni
  // l'erreur ne surviennent, la promesse ne se résout jamais — `placeTenue` PEND, et
  // `passerLaMain` avec elle. Une étape qui pend ne rougit jamais ; c'est la borne de ce
  // banc (`timeout`) qui transforme cette attente-là en échec visible.
  // ⚠️ CE DOUBLE RETIENT LA BOUCLE, ET C'EST OBLIGATOIRE POUR QU'IL SOIT CONFORME.
  // Mesuré en CI : sans rien qui la retienne, ce banc rendait `cancelledByParent` — « Promise
  // resolution is still pending but the event loop has already resolved ». La cause n'était
  // PAS dans `placeTenue` : c'est le VRAI socket en vol qui tient la boucle le temps de la
  // prise. Un double sans aucun handle fabriquait une situation que la production ne connaît
  // pas, et aurait fait accuser le code. Un double doit être conforme au service qu'il
  // remplace, y compris sur ce qu'il RETIENT.
  let ferme = 0;
  const priseQuiNeConclutJamais = () => {
    const enVol = setTimeout(() => {}, 60_000); // ce qu'un socket en vol retient
    return {
      on() {}, // ni « connect », ni « error » : rien ne viendra jamais de ce côté-là
      destroy() {
        ferme += 1;
        clearTimeout(enVol);
      },
    };
  };

  // Le faux minuteur N'ARME RIEN : il note ce qu'on lui a demandé et attend qu'on le
  // déclenche. Tant que le banc ne tire pas lui-même, aucune horloge ne peut trancher à sa
  // place — c'est ce qui rend l'observation exacte plutôt que probable.
  const planifies = [];
  const annules = [];
  const planifier = (fn, delai) => {
    const jeton = { fn, delai, unref() {} };
    planifies.push(jeton);
    return jeton;
  };
  const annuler = (jeton) => annules.push(jeton);

  const promesse = placeTenue(join(racine, 'peu-importe.sock'), {
    borne: 60,
    brancher: priseQuiNeConclutJamais,
    planifier,
    annuler,
  });

  // 1. UN MINUTEUR A ÉTÉ ARMÉ, ET AVEC LA BORNE DEMANDÉE. Sans lui, il ne resterait aucune
  // issue : la prise ne conclut jamais.
  assert.equal(planifies.length, 1, 'la sonde arme UN minuteur — sans lui, une prise qui ne conclut jamais la fait pendre');
  assert.equal(planifies[0].delai, 60, 'le minuteur est armé avec la borne reçue, pas avec une valeur de son cru');

  // 2. 🔴 LE DISCRIMINANT, ET IL NE REGARDE AUCUNE HORLOGE. Tant que personne n'a déclenché
  // le minuteur, la promesse DOIT être en attente. Si un raccourci tranchait à sa place, elle
  // serait déjà résolue ici — et ce banc rougirait sur cette ligne. C'est la contre-épreuve
  // exigée par T-20260920-0013, et elle ne dépend pas de la charge du runner.
  assert.equal(await etatDe(promesse), 'en attente', 'le verdict doit venir DU MINUTEUR : tant qu’il n’est pas déclenché, rien ne doit avoir tranché');

  // 3. ON TIRE LE MINUTEUR NOUS-MÊME. Ce qui suit est donc imputable à lui seul.
  planifies[0].fn();
  const verdict = await promesse;

  // 4. ELLE REND, ET ELLE REND « TENUE ». Le doute penche du côté prudent : « je n'ai pas pu
  // savoir » ne doit JAMAIS autoriser un second veilleur à effacer le socket d'un vivant.
  assert.equal(verdict, true, 'un doute non résolu doit pencher du côté « la place est tenue », jamais du côté qui ouvre la porte à un double');
  assert.equal(ferme, 1, 'la sonde referme la prise qu’elle a ouverte, même quand c’est le minuteur qui tranche');
  assert.deepEqual(annules, [planifies[0]], 'la sonde annule le minuteur qu’elle a armé — celui-là, et une fois');
});

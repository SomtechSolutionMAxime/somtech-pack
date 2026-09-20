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
// rien : on laisse passer UN TOUR DE BOUCLE, puis on fait courir la promesse contre un
// témoin déjà résolu. L'ordre des microtâches est déterministe.
//
// ⚠️ LE TOUR DE BOUCLE N'EST PAS UNE ATTENTE, ET LE COMPTER SERAIT UN DÉFAUT.
// La première écriture de cette sonde vidait « seize tours de microtâche ». Une revue
// adversariale l'a prise en défaut : une promesse qui tranche au DIX-SEPTIÈME tour était
// déclarée « en attente » à tort, et ça restait faux jusqu'à cent tours. Un seuil choisi
// à la main sur une file qu'on ne contrôle pas est le même défaut que la borne de 60 ms,
// déplacé du temps vers un compte.
// `setImmediate` n'a pas ce problème : Node draine la file de microtâches ENTIÈREMENT entre
// deux phases de la boucle. Une chaîne de promesses, longue de dix ou de mille maillons,
// est donc résolue avant que ce rappel-ci s'exécute — sans qu'aucun nombre soit à choisir,
// et sans qu'aucune durée soit à attendre.
//
// ⚠️ ET DEUX PHASES, PAS UNE. `setImmediate` seul laissait échapper une promesse résolue
// par un `setTimeout` — la phase `check` passe avant la phase `timers`, et l'instrument la
// déclarait « en attente » à tort, de façon reproductible. Ça ne trompait aucun banc d'ici,
// où le minuteur est simulé ; mais `placeTenue` reçoit `setTimeout` PAR DÉFAUT en production,
// donc l'instrument aurait menti le jour où quelqu'un l'aurait pointé sur un vrai appel.
// Le `0` n'est pas une durée qu'on attend : c'est le passage par la phase des minuteurs.
//
// 🔴 CE QUE CETTE SONDE NE VOIT PAS, ET IL FAUT LE DIRE ICI PLUTÔT QUE DE LE DÉCOUVRIR :
// une résolution qui demande DEUX sauts de boucle imbriqués (un `setTimeout` dans un
// `setTimeout`) est encore rendue « en attente ». Ce n'est pas un défaut de comptage — c'est
// la borne assumée de l'instrument : il répond « rien n'a tranché au tour suivant », pas
// « rien ne tranchera jamais ». Pour ce que ce banc éprouve, où le raccourci qu'on cherche
// tranche SYNCHRONEMENT, c'est exactement ce qu'il faut.
const TEMOIN_EN_ATTENTE = Symbol('en attente');
async function etatDe(promesse) {
  await new Promise((r) => setTimeout(r, 0)); // phase des minuteurs
  await new Promise((r) => setImmediate(r)); // phase des rappels immédiats
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

// LES TROIS BRANCHES QUI PEUVENT TRANCHER EN PREMIER — BALAYÉES, PAS ÉNUMÉRÉES À LA MAIN.
//
// 🔴 CE BLOC A REMPLACÉ DEUX BANCS QUASI JUMEAUX, ET LA RAISON MÉRITE D'ÊTRE ÉCRITE ICI
// (T-20260920-0013). Trois passes de revue adversariale ont rendu trois survivantes. Après
// coup, les trois posaient LA MÊME QUESTION : « pour cette branche-ci qui décide en premier,
// un écho tardif des autres est-il neutralisé ? » Chaque correctif fermait une branche et
// laissait les autres, parce qu'il était écrit à la main, pour le cas qu'on venait de voir.
//
// > Trois fois la même famille de défaut, ce n'est plus un oubli de rigueur : c'est qu'on
// > énumère à la main une combinatoire qu'on pourrait balayer.
//
// `placeTenue` a EXACTEMENT trois façons de trancher : le minuteur, la connexion, l'erreur.
// C'est fermé, et ça se balaie. Une quatrième variante de la même famille ne peut plus
// exister — s'il en apparaît une, elle viendra d'ailleurs, et ce sera une information.
//
// Chaque tour du balayage : on arme, on vérifie que RIEN n'a tranché tant qu'on n'a rien
// déclenché, on déclenche LA branche du tour, on vérifie son verdict, puis on tire les DEUX
// AUTRES comme échos tardifs et on réaffirme que rien n'a bougé.
const DECIDEURS = [
  {
    nom: 'LE MINUTEUR',
    canal: 'minuteur',
    verdict: true,
    // C'est le cas d'origine du ticket : une prise qui ne conclut jamais. Sans le minuteur,
    // la promesse ne se résoudrait pas — `placeTenue` PEND, et `passerLaMain` avec elle.
    // Une étape qui pend ne rougit jamais ; c'est la borne de ce banc qui la rend visible.
    pourquoi: 'un doute non résolu penche du côté « la place est tenue », jamais du côté qui ouvre la porte à un double',
  },
  {
    nom: 'LA CONNEXION',
    canal: 'connect',
    verdict: true,
    // Le cas NOMINAL, et le plus fréquent : une place tenue est la normale, pas l'exception.
    pourquoi: 'une prise qui aboutit dit que la place est tenue',
  },
  {
    nom: "L'ERREUR",
    canal: 'error',
    verdict: false,
    // Le poste sans veilleur du tout : rien n'écoute à cette adresse. L'erreur de connexion
    // locale est quasi instantanée — le minuteur réel est donc encore armé quand elle arrive.
    pourquoi: 'une prise refusée dit que la place est libre — c’est le seul verdict qui autorise à prendre le socket',
  },
];

for (const decideur of DECIDEURS) {
  test(`QUI TRANCHE EN PREMIER TRANCHE SEUL — ${decideur.nom} décide, et les échos tardifs ne renversent rien`, { timeout: 5000 }, async () => {
    // ⚠️ CE BANC NE MESURE AUCUNE DURÉE, ET C'EST TOUT SON OBJET.
    // Il comparait `Date.now()` à la borne pour prouver que le verdict venait du minuteur :
    // `rendu en 59 ms pour une borne de 60 ms`. Une milliseconde de dérive sur un runner
    // chargé, et il rougissait — QUATRE fois sur TROIS lots, dont deux fois sur un lot qui
    // ne touchait que des fichiers markdown. Vert au rejeu du même job à chaque fois.
    //
    // > Une garde qui COMPTE mesure la machine autant que le code, et son rouge accuse le
    // > code en parlant du runner.
    //
    // ⚠️ ÉLARGIR LA BORNE (60 → 200 ms) AURAIT ÉTÉ LE PIÈGE : vert, et toujours en train de
    // mesurer la machine, seulement plus lentement. Le discriminant n'est donc plus un temps,
    // c'est UN APPEL — le minuteur est injecté, et le banc observe.
    //
    // ⚠️ CE DOUBLE RETIENT LA BOUCLE, ET C'EST OBLIGATOIRE POUR QU'IL SOIT CONFORME.
    // Mesuré en CI : sans rien qui la retienne, ce banc rendait `cancelledByParent` — « Promise
    // resolution is still pending but the event loop has already resolved ». La cause n'était
    // PAS dans `placeTenue` : c'est le VRAI socket en vol qui tient la boucle le temps de la
    // prise. Un double sans aucun handle fabriquait une situation que la production ne connaît
    // pas, et aurait fait accuser le code.
    let ferme = 0;
    const ecouteurs = new Map();
    const priseQuiNeDecideDeRien = () => {
      const enVol = setTimeout(() => {}, 60_000); // ce qu'un socket en vol retient
      return {
        // Le double CAPTURE ses écouteurs au lieu de les jeter : rien ne vient d'eux de
        // lui-même, et le banc choisit lequel tirer, quand.
        on(evenement, rappel) {
          ecouteurs.set(evenement, rappel);
        },
        destroy() {
          ferme += 1;
          clearTimeout(enVol);
        },
      };
    };

    // Le faux minuteur N'ARME RIEN : il note ce qu'on lui a demandé et attend qu'on le
    // déclenche. Aucune horloge ne peut trancher à la place du banc.
    // `unref` se COMPTE ici, il ne se subit pas : un minuteur qu'on oublie de détacher retient
    // la boucle, et ce fichier porte déjà la facture d'un tel oubli ailleurs (`ligne-directe
    // etat` passé de 62 ms à 3062 ms).
    const planifies = [];
    const annules = [];
    const planifier = (fn, delai) => {
      const jeton = { fn, delai, detaches: 0, unref() { jeton.detaches += 1; } };
      planifies.push(jeton);
      return jeton;
    };
    const annuler = (jeton) => annules.push(jeton);

    const promesse = placeTenue(join(racine, 'peu-importe.sock'), {
      borne: 60,
      brancher: priseQuiNeDecideDeRien,
      planifier,
      annuler,
    });

    // 1. UN MINUTEUR A ÉTÉ ARMÉ, AVEC LA BORNE DEMANDÉE — sur les trois branches, parce
    // qu'on ne sait pas encore laquelle tranchera.
    assert.equal(planifies.length, 1, 'la sonde arme UN minuteur — sans lui, une prise qui ne conclut jamais la fait pendre');
    assert.equal(planifies[0].delai, 60, 'le minuteur est armé avec la borne reçue, pas avec une valeur de son cru');

    // 2. 🔴 LE DISCRIMINANT, ET IL NE REGARDE AUCUNE HORLOGE. Tant qu'on n'a rien déclenché,
    // la promesse DOIT être en attente. Un raccourci qui trancherait tout seul serait déjà
    // résolu ici — et ce banc rougirait sur cette ligne, jamais sur une durée.
    assert.equal(await etatDe(promesse), 'en attente', 'aucun verdict ne doit tomber avant qu’une des trois branches ait parlé');

    // 3. ON TIRE LA BRANCHE DU TOUR. Ce qui suit lui est donc imputable, à elle seule.
    if (decideur.canal === 'minuteur') planifies[0].fn();
    else ecouteurs.get(decideur.canal)();

    assert.equal(await promesse, decideur.verdict, decideur.pourquoi);
    assert.equal(ferme, 1, 'la sonde referme la prise qu’elle a ouverte, quelle que soit la branche qui a tranché');
    assert.deepEqual(annules, [planifies[0]], 'la sonde annule le minuteur qu’elle a armé — celui-là, et une fois');
    assert.equal(planifies[0].detaches, 1, 'le minuteur est détaché de la boucle — sinon il retient le processus jusqu’à son terme');

    // 4. 🔴 LES ÉCHOS TARDIFS DES DEUX AUTRES BRANCHES. Un socket qui se connecte enfin, une
    // erreur qui arrive après coup, un minuteur mal annulé : rien de tout cela ne doit
    // renverser un verdict rendu, ni refermer la prise deux fois, ni annuler deux minuteurs.
    // C'est ce balayage qui ferme la famille de défauts — auparavant chaque branche était
    // écrite à la main, et il en manquait toujours une.
    for (const autre of DECIDEURS.filter((d) => d.canal !== decideur.canal)) {
      if (autre.canal === 'minuteur') planifies[0].fn();
      else ecouteurs.get(autre.canal)();
    }

    assert.equal(await promesse, decideur.verdict, 'un écho tardif d’une autre branche ne renverse pas un verdict déjà rendu');
    assert.equal(ferme, 1, 'la prise n’est refermée qu’UNE fois, même si les autres branches parlent après coup');
    assert.deepEqual(annules, [planifies[0]], 'le minuteur n’est annulé qu’UNE fois, même après les échos tardifs');
  });
}

test('LE RÉGLAGE PAR DÉFAUT DE LA SONDE EST GARDÉ, LUI AUSSI — deux secondes, et personne ne les surveillait', { timeout: 5000 }, async () => {
  // 🔴 UNE SURVIVANTE D'UNE AUTRE FAMILLE, TROUVÉE À LA QUATRIÈME PASSE (T-20260920-0013).
  // Tout ce que ce fichier éprouve du minuteur passe une borne EXPLICITE — soixante
  // millisecondes, partout. Les appels réels qui n'en passent pas tranchent par `connect` ou
  // `error` sur un vrai socket, presque instantanément : le chiffre du défaut n'influence
  // donc jamais un verdict observé.
  // Mutation qui l'a révélé : porter le défaut de 2 000 ms à 20 000 000 ms — cinq heures
  // et demie. **Les 1355 bancs du module restaient verts.**
  //
  // > Les trois passes précédentes demandaient « QUI décide ». Celle-ci demande « AVEC QUEL
  // > RÉGLAGE » — et c'est une question que le balayage des branches ne pose pas.
  //
  // Ce que ça coûterait : ce minuteur est le filet qui empêche `placeTenue` de PENDRE quand
  // ni la prise ni l'erreur ne viennent. Un défaut qui dériverait en silence laisserait ce
  // filet inopérant pendant des heures — c'est-à-dire l'exact défaut que ce lot a été
  // ouvert pour rendre éprouvable.
  //
  // ⚠️ ON PASSE `brancher` ET `planifier`, JAMAIS `borne` : c'est ce qui rend le défaut
  // observable sans le remplacer. Le banc lit le délai que la sonde a choisi seule.
  //
  // ⚠️ ET UN TROU DE NOMMAGE, SIGNALÉ PLUTÔT QUE CORRIGÉ ICI : ce 2 000 est un littéral
  // anonyme, alors que `BORNE_PAR_DEFAUT` existe dans le même fichier — et vaut 30 000, pour
  // un autre geste. Deux « bornes par défaut » dans un même module, dont une seule porte un
  // nom : le renommage touche la production et n'est pas de ce lot, mais la garde ci-dessous
  // fait qu'une dérive se verra.
  const planifies = [];
  const promesse = placeTenue(join(racine, 'peu-importe.sock'), {
    brancher: () => {
      const enVol = setTimeout(() => {}, 60_000);
      return { on() {}, destroy() { clearTimeout(enVol); } };
    },
    planifier: (fn, delai) => {
      const jeton = { fn, delai, unref() {} };
      planifies.push(jeton);
      return jeton;
    },
    annuler: () => {},
  });

  assert.equal(planifies[0].delai, 2000, 'la sonde arme son minuteur à deux secondes quand on ne lui dit rien — un défaut qui dérive laisse le filet inopérant sans qu’aucun banc ne rougisse');
  planifies[0].fn();
  assert.equal(await promesse, true, 'et ce défaut-là tranche bien du côté prudent');
});

test('LE VRAI MINUTEUR TRANCHE POUR DE BON — sans lui, il n’y a plus de filet du tout', { timeout: 5000 }, async () => {
  // 🔴 LA DERNIÈRE SURVIVANTE, ET LA PLUS SÉVÈRE (T-20260920-0013).
  // Tout ce que ce fichier éprouve du minuteur passe un `planifier` SIMULÉ — c'est ce qui
  // permet d'observer l'appel au lieu de mesurer une durée, et c'est tout l'objet du lot.
  // Mais du coup, le `planifier` PAR DÉFAUT n'était éprouvé par rien.
  // Mutation : `planifier = () => ({})` — il ne programme plus jamais rien. **11 bancs sur
  // 11 restaient verts.**
  //
  // > On avait rendu le minuteur observable, et rendu du même coup le VRAI minuteur
  // > inobservable. Le joint qui permet d'éprouver une chose peut la soustraire à l'épreuve.
  //
  // Et ce n'est pas « le filet est trop lâche », comme pour la borne : c'est **plus de filet
  // du tout**. Si un vrai socket ne conclut jamais — le cas d'origine de ce ticket — rien ne
  // referme la promesse : `placeTenue` pend, et `passerLaMain` avec elle. Une étape qui pend
  // ne rougit jamais.
  //
  // ⚠️ CE BANC ATTEND UN VRAI DÉLAI, MAIS IL N'EN MESURE AUCUN — ET LA DIFFÉRENCE EST TOUT
  // CE QUI SÉPARE CE LOT DE L'ANCIEN BANC. Il ne compare rien à une borne : il demande
  // seulement que la promesse FINISSE par trancher. Si le minuteur par défaut est cassé, elle
  // ne tranche jamais, et c'est la borne du test (`timeout`) qui rend l'attente visible — un
  // échec franc, pas un écart d'une milliseconde. Aucune charge de runner ne peut le rendre
  // rouge à tort : sur une machine lente, on attend simplement un peu plus longtemps.
  // La borne de 30 ms est explicite pour ne pas payer les deux secondes du défaut à chaque
  // passage — le défaut lui-même est gardé par le banc juste au-dessus.
  //
  // ⚠️ ET COMMENT CE ROUGE-LÀ SE PRÉSENTE, PARCE QUE ÇA PEUT TROMPER : sous la mutation, le
  // relevé rend `fail 0` et `cancelled 1` — un banc qui n'aboutit pas est compté annulé, pas
  // échoué. **Le code de sortie est bien 1**, donc la chaîne rougit ; mesuré, pas supposé.
  // Mais quelqu'un qui lirait la seule ligne `fail 0` conclurait que tout va bien.
  let ferme = 0;
  const priseQuiNeConclutJamais = () => {
    const enVol = setTimeout(() => {}, 60_000);
    return { on() {}, destroy() { ferme += 1; clearTimeout(enVol); } };
  };

  // ⚠️ NI `planifier` NI `annuler` ICI : ce sont les VRAIS `setTimeout`/`clearTimeout` qu'on
  // éprouve, et c'est le seul banc du fichier qui les laisse au défaut.
  const verdict = await placeTenue(join(racine, 'peu-importe.sock'), {
    borne: 30,
    brancher: priseQuiNeConclutJamais,
  });

  assert.equal(verdict, true, 'le vrai minuteur tranche, et du côté prudent — sans lui, la sonde pend et rien ne le dit');
  assert.equal(ferme, 1, 'et il referme la prise en tranchant, comme le fait son double');
});

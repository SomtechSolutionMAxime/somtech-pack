// UNE BOÎTE OUBLIÉE SE DÉBLOQUE TOUTE SEULE (T-20260818-0078).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT, DANS LES MOTS DU DIRIGEANT
//
//   « Ok et c quoi notre stratégie pour débloquer les boîtes automatiquement ? »
//
// Il n'y en avait pas : `delivrerLaBoite` n'est appelée que depuis les chemins de LIVRAISON.
// Une boîte que plus personne ne relance restait bloquée indéfiniment — `ristigouche` 55
// minutes, et deux fois le prompt de ronde d'un orchestrateur coincé dans sa propre boîte,
// **qui ne faisait donc plus ses rondes sans que rien ne le lui dise**.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE BANC AURAIT PU NE PAS POUVOIR ÉCHOUER, ET C'EST LA PREMIÈRE CHOSE QU'IL PROUVE
//
// Le faux herdr de ce dépôt ne servait PAS `agent list` : `posteHerdr` doublait `agents()` au
// niveau module. Un balayeur éprouvé là-dessus aurait vu **zéro agent**, n'aurait rien balayé,
// et serait passé au vert sans avoir jamais balayé — le motif exact que ce dépôt a déjà payé
// deux fois. Le premier essai ci-dessous est donc une GARDE SUR LE BANC : il échoue si le tour
// ne voit pas les agents que le banc a posés. Le faux binaire a été étendu pour ça, et
// l'inventaire passe désormais par le TRANSPORT, comme tout le reste.
//
// ⚠️ ET LE GESTE N'EST PAS DOUBLÉ. `delivrer` est câblé sur le VRAI `delivrerLaBoite`, qui parle
// au faux binaire. Les abstentions — choix, dialogue — sont donc prouvées par l'ABSENCE de
// `send-keys` dans le journal d'appels, jamais par le verdict que rendrait un double complaisant.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { posteHerdr } from './aide/faux-herdr.js';
import { unePasse, unTourDeBalayage } from '../src/balayage.js';
import { delivrerLaBoite, FENETRE_DU_BALAYAGE_MS } from '../src/delivrance.js';

const execFileP = promisify(execFile);

let bac;
let pathOriginal;
let racineOriginale;

// ⚠️ AUCUN ESSAI NE TOUCHE `~/.somtech/ligne-directe` — il porte les lignes VIVANTES du
// dirigeant. La racine est jetable, comme dans `registre.test.js`, et le `PATH` ne porte que le
// faux binaire : rien de ce banc ne peut atteindre les agents réels du poste.
before(() => {
  bac = mkdtempSync(join(tmpdir(), 'ld-balayage-'));
  pathOriginal = process.env.PATH;
  racineOriginale = process.env.LIGNE_DIRECTE_RACINE;
  process.env.LIGNE_DIRECTE_RACINE = join(bac, 'racine');
});
after(() => {
  process.env.PATH = pathOriginal;
  delete process.env.FAUX_HERDR_ETAT;
  if (racineOriginale === undefined) delete process.env.LIGNE_DIRECTE_RACINE;
  else process.env.LIGNE_DIRECTE_RACINE = racineOriginale;
  rmSync(bac, { recursive: true, force: true });
});

/**
 * Un poste neuf par essai : les états de panes et le journal d'appels ne se mélangent pas.
 *
 * ⚠️ `FAUX_HERDR_ETAT` N'EST PAS DÉCORATIF — sans lui le faux binaire meurt avant de jouer son
 * scénario, et tout ce qu'on lit devient « écran illisible », c'est-à-dire une abstention
 * parfaitement plausible. C'est le mode de panne le plus traître de ce banc : il rend des
 * refus NOMMÉS au lieu de rendre une erreur.
 */
function poste(nom, agents) {
  const p = posteHerdr(bac, agents, nom);
  process.env.PATH = p.path;
  process.env.FAUX_HERDR_ETAT = p.etat;
  return p;
}

/** L'I/O du tour, câblée sur le faux binaire — le transport est doublé, jamais la logique. */
function branchements(p, { avertir } = {}) {
  const lire = async (pane) => {
    try {
      const { stdout } = await execFileP('herdr', ['agent', 'read', pane, '--format', 'ansi'], {
        env: { ...process.env, PATH: p.path },
      });
      return stdout;
    } catch {
      return null;
    }
  };
  return {
    lireEcran: (a) => lire(a.pane),
    delivrer: ({ pane, texteCoince, immobiliteMs }) =>
      delivrerLaBoite({
        texteCoince,
        commandes: {
          lireEcran: ['agent', 'read', pane, '--format', 'ansi'],
          soumettre: ['agent', 'send-keys', pane, 'Enter'],
        },
        appelHerdr: async (cmd) => {
          try {
            await execFileP('herdr', cmd, { env: { ...process.env, PATH: p.path } });
            return { ok: true };
          } catch {
            return { ok: false };
          }
        },
        lireEcran: async () => lire(pane),
        // ⚠️ LA FENÊTRE EST NEUTRALISÉE ICI, ET ELLE SEULEMENT. Ce n'est pas la garde de ce
        // chemin — la garde, ce sont les TROIS TOURS, et eux sont éprouvés pour de vrai.
        // Dormir dix secondes par candidat ne prouverait rien de plus qu'un banc lent.
        dormir: async () => {},
        immobiliteMs,
        essais: 3,
        delaiMs: 1,
      }),
    avertir: avertir || (async () => {}),
  };
}

const touchesEnvoyees = (p, pane) =>
  p.gestes(pane).filter((a) => a[0] === 'agent' && a[1] === 'send-keys').length;

/** Enchaîne N tours en reportant la mémoire — c'est le report qui fait le compteur. */
async function tours(n, { p, agents, sousBail, journal, avertir, avant }) {
  let memoire = new Map();
  let rendu = null;
  for (let i = 0; i < n; i += 1) {
    if (avant) await avant(i);
    rendu = await unTourDeBalayage({
      agents,
      ...branchements(p, { avertir }),
      sousBail: sousBail || (() => false),
      memoire,
      maintenant: 1_000_000 + i * 60_000,
      journaliser: (m) => journal?.push(m),
    });
    memoire = rendu.memoire;
  }
  return rendu;
}

// ═══ 0. LA GARDE SUR LE BANC — sans elle, tout le reste est du vert sans preuve ═══════════

test('LE TOUR VOIT LES AGENTS QUE LE BANC A POSÉS — sinon le banc ne peut pas échouer', async () => {
  const p = poste('inventaire', [
    { pane_id: 'w1:p1', name: 'ristigouche' },
    { pane_id: 'w2:p3', name: 'orchestrateur' },
  ]);
  p.pane('w1:p1', { boite: '' });
  p.pane('w2:p3', { boite: '' });

  const { agents } = await import('../src/herdr.js');
  const rendu = await tours(1, { p, agents: () => agents({ socket: join(bac, 'faux.sock') }) });

  assert.equal(
    rendu.vus,
    2,
    'LE TOUR NE VOIT AUCUN AGENT LÀ OÙ LE BANC EN A POSÉ DEUX : le faux herdr ne sert pas ' +
      '`agent list`, donc tous les essais qui suivent passeraient au vert sans avoir rien balayé.'
  );
});

// ═══ 1. TROIS TOURS DÉLIVRENT — DEUX NE DÉLIVRENT PAS ═══════════════════════════════════

test('une boîte immobile sur TROIS tours est délivrée — et à DEUX tours, elle ne l’est pas', async () => {
  const p = poste('trois-tours', [{ pane_id: 'w1:p1', name: 'ristigouche' }]);
  p.pane('w1:p1', { boite: 'le prompt de ronde que personne ne soumet' });
  const liste = [{ pane_id: 'w1:p1', name: 'ristigouche', herdr_socket: '/s/1' }];

  const deux = await tours(2, { p, agents: liste });
  assert.equal(touchesEnvoyees(p, 'w1:p1'), 0, 'À DEUX TOURS ON N’A PAS ENCORE LE DROIT — la boîte reste intacte');
  assert.equal(deux.debloques.length, 0);
  assert.equal(deux.refus.at(-1).cause, 'pas-encore-immobile');

  const trois = await tours(3, { p, agents: liste });
  assert.equal(touchesEnvoyees(p, 'w1:p1'), 1, 'au troisième tour, la touche d’envoi part — une seule fois');
  assert.equal(trois.debloques.length, 1);
  assert.equal(trois.debloques[0].texte, 'le prompt de ronde que personne ne soumet');
  assert.equal(trois.debloques[0].tours, 3);
  assert.equal(p.recu('w1:p1'), 'le prompt de ronde que personne ne soumet', 'et le texte est PARTI, entier');
});

// ═══ 2. UN TEXTE QUI CHANGE REMET LE COMPTEUR À ZÉRO ════════════════════════════════════

test('un texte qui change au 2ᵉ tour REMET LE COMPTEUR À ZÉRO — un banc vivant n’est pas une boîte oubliée', async () => {
  const p = poste('remise-a-zero', [{ pane_id: 'w1:p1', name: 'ristigouche' }]);
  const liste = [{ pane_id: 'w1:p1', name: 'ristigouche' }];

  // Quelqu'un compose : le texte grossit d'un tour à l'autre, puis se fige.
  const rendu = await tours(3, {
    p,
    agents: liste,
    avant: (i) => p.pane('w1:p1', { boite: i === 0 ? 'je suis en train de' : 'je suis en train de taper une phrase' }),
  });

  assert.equal(
    touchesEnvoyees(p, 'w1:p1'),
    0,
    'SANS LA REMISE À ZÉRO, ON SOUMET LA PHRASE DE QUELQU’UN QUI EST EN TRAIN DE LA TAPER : ' +
      'le texte n’a été immobile que sur DEUX tours, pas trois.'
  );
  assert.equal(rendu.debloques.length, 0);
  assert.equal(rendu.memoire.get('w1:p1').tours, 2, 'le compteur repart de la première lecture du NOUVEAU texte');

  // Un tour de plus sur le même texte, et là seulement il part.
  const quatre = await unTourDeBalayage({
    agents: liste,
    ...branchements(p),
    memoire: rendu.memoire,
    maintenant: 1_000_000 + 3 * 60_000,
  });
  assert.equal(quatre.debloques.length, 1, 'trois tours du MÊME texte, et il part');
});

// ═══ 3. LE BAIL PASSE AVANT TOUT LE RESTE ═══════════════════════════════════════════════

test('un pane SOUS BAIL n’est pas touché — même avec une boîte immobile depuis dix tours', async () => {
  const p = poste('bail', [{ pane_id: 'w1:p1', name: 'ristigouche' }]);
  p.pane('w1:p1', { boite: 'un texte parfaitement immobile' });

  const rendu = await tours(10, {
    p,
    agents: [{ pane_id: 'w1:p1', name: 'ristigouche' }],
    sousBail: (pane) => pane === 'w1:p1',
  });

  assert.equal(touchesEnvoyees(p, 'w1:p1'), 0, 'UN BAIL NE SE DISCUTE PAS CONTRE CE QU’ON CROIT VOIR À L’ÉCRAN');
  assert.equal(rendu.debloques.length, 0);
  assert.equal(rendu.refus[0].cause, 'bail', 'et l’abstention est NOMMÉE par sa cause');
  assert.equal(p.gestes('w1:p1').length, 0, 'on ne lit même pas son écran : « on ne touche pas » va jusque-là');
  assert.equal(rendu.memoire.size, 0, 'et il ne reste rien en mémoire — un compteur d’avant le bail serait périmé');
});

// ═══ 4. UNE BOÎTE QU'ON N'A PAS LUE N'EST PAS UNE BOÎTE VIDE ════════════════════════════

test('`contenuBoite → null` ne fait JAMAIS soumettre — on ne soumet pas ce qu’on n’a pas lu', async () => {
  // Le pane est à l'inventaire mais herdr ne le connaît pas : `agent read` rend un JSON
  // d'erreur, dont `contenuBoite` ne tire aucune boîte. C'est `null`, pas `''`.
  const p = poste('pas-lue', [{ pane_id: 'w9:p9', name: 'fantome' }]);

  const rendu = await tours(5, { p, agents: [{ pane_id: 'w9:p9', name: 'fantome' }] });

  assert.equal(touchesEnvoyees(p, 'w9:p9'), 0);
  assert.equal(rendu.debloques.length, 0);
  assert.equal(rendu.refus[0].cause, 'pas-lue');
  assert.equal(rendu.memoire.size, 0, 'une boîte illisible ne s’accumule pas en mémoire');
});

// ═══ 5. UN CHOIX, UN DIALOGUE — L'ABSTENTION SE PROUVE PAR L'ABSENCE DE GESTE ═══════════

test('une boîte qui porte un CHOIX ne reçoit aucune touche — l’abstention est prouvée par le journal', async () => {
  const p = poste('choix', [{ pane_id: 'w3:p1', name: 'devant-un-choix' }]);
  p.pane('w3:p1', { boite: '1. Yes, proceed\n2. No' });

  const rendu = await tours(3, { p, agents: [{ pane_id: 'w3:p1', name: 'devant-un-choix' }] });

  assert.equal(
    touchesEnvoyees(p, 'w3:p1'),
    0,
    'LA TOUCHE D’ENVOI DEVANT UN CHOIX APPROUVE UNE ACTION au lieu de soumettre un texte'
  );
  assert.equal(rendu.refus.at(-1).cause, 'choix', 'et la cause vient du geste lui-même, pas d’une garde recopiée ici');
  assert.equal(rendu.debloques.length, 0);
});

test('un DIALOGUE affiché par-dessus une boîte lisible fait s’abstenir aussi', async () => {
  const p = poste('dialogue', [{ pane_id: 'w4:p2', name: 'sous-un-modal' }]);
  // La boîte est ordinaire ; c'est l'ÉCRAN qui attend un choix. C'est le cas mesuré du
  // 2026-08-17, où écrire a fait EXÉCUTER la commande proposée.
  p.pane('w4:p2', { boite: 'un texte tout à fait ordinaire', horsBoite: 'Do you want to proceed? ❯ 1. Yes' });

  const rendu = await tours(3, { p, agents: [{ pane_id: 'w4:p2', name: 'sous-un-modal' }] });

  assert.equal(touchesEnvoyees(p, 'w4:p2'), 0);
  assert.equal(rendu.refus.at(-1).cause, 'dialogue');
});

// ═══ 6. L'AVIS — CE QUI EST PARTI, ET PAR QUOI ══════════════════════════════════════════

test('après délivrance, l’avis dit LE TEXTE LIBÉRÉ et PAR QUOI il a été soumis', async () => {
  const p = poste('avis', [{ pane_id: 'w1:p1', name: 'ristigouche' }]);
  p.pane('w1:p1', { boite: 'ordre du CTO resté en boîte' });
  const avis = [];

  const rendu = await tours(3, {
    p,
    agents: [{ pane_id: 'w1:p1', name: 'ristigouche', herdr_socket: '/s/7' }],
    avertir: async (pane, texte, vers) => avis.push({ pane, texte, vers }),
  });

  assert.equal(avis.length, 1, 'un avis, et un seul');
  assert.equal(avis[0].pane, 'w1:p1');
  assert.equal(avis[0].vers.socket, '/s/7', 'porté à la session DE CET AGENT, pas à la plus récente du poste');
  assert.match(avis[0].texte, /ordre du CTO resté en boîte/, 'LE TEXTE LIBÉRÉ, ENTIER — sinon l’incident est inexplicable');
  assert.match(avis[0].texte, /balayeur de boîtes oubliées/, 'ET PAR QUOI — c’est le critère du ticket, et rien d’autre ne le porte');
  assert.match(
    avis[0].texte,
    /aucun message ne suit/i,
    'sur ce chemin il n’y a rien à livrer : promettre un second message enverrait l’attendre'
  );
  assert.equal(rendu.debloques[0].avis, 'remis');
});

test('un `avertir` qui JETTE ne fait pas échouer le tour — et l’échec est au compte rendu', async () => {
  const p = poste('avis-perdu', [{ pane_id: 'w1:p1', name: 'ristigouche' }]);
  p.pane('w1:p1', { boite: 'un texte qui va partir quand même' });
  const journal = [];

  const rendu = await tours(3, {
    p,
    agents: [{ pane_id: 'w1:p1', name: 'ristigouche' }],
    journal,
    avertir: async () => {
      throw new Error('slack injoignable');
    },
  });

  assert.equal(rendu.debloques.length, 1, 'le geste, lui, a bien eu lieu — le tour ne le renie pas');
  assert.equal(rendu.debloques[0].avis, 'perdu');
  assert.match(rendu.debloques[0].avisRefuse, /slack injoignable/);
  assert.equal(rendu.avisPerdus, 1, 'UN AVIS PERDU EN SILENCE EST LE DÉFAUT QUE L’AVIS EXISTE POUR FERMER');
  assert.ok(journal.some((l) => /AVIS PERDU/.test(l)), 'et il laisse une trace lisible');
});

// ═══ 7. LE BATTEMENT DE CŒUR ════════════════════════════════════════════════════════════

test('le tour JOURNALISE QU’IL A TOURNÉ, même quand il n’a rien fait', async () => {
  const p = poste('battement', [{ pane_id: 'w1:p1', name: 'au-repos' }]);
  p.pane('w1:p1', { boite: '' });
  const journal = [];

  const rendu = await tours(1, { p, agents: [{ pane_id: 'w1:p1', name: 'au-repos' }], journal });

  assert.equal(rendu.debloques.length, 0);
  assert.ok(
    journal.some((l) => /tour passé/.test(l)),
    'UNE RONDE ÉTEINTE NE PRODUIT AUCUNE ERREUR : sans témoin de passage, on ne détecte pas son absence'
  );
  assert.ok(journal.some((l) => /1 pane\(s\) vus/.test(l)), 'et le témoin porte les deux chiffres du tour');
});

test('un inventaire qui JETTE ne se déguise pas en « aucun agent »', async () => {
  const journal = [];
  const rendu = await unTourDeBalayage({
    agents: async () => {
      throw new Error('herdr introuvable sur le PATH');
    },
    journaliser: (m) => journal.push(m),
  });
  assert.equal(rendu.vus, 0);
  assert.match(rendu.inventaireRefuse, /introuvable/);
  assert.ok(journal.some((l) => /SANS INVENTAIRE/.test(l)), 'un tour aveugle doit se dénoncer, pas rendre du vert');
});

// ═══ 8. LA MÉMOIRE NE DOIT PAS ENFLER ═══════════════════════════════════════════════════

test('la mémoire ne garde pas un pane disparu — elle tourne des semaines sur un poste vivant', () => {
  const t = 1_000_000;
  const premier = unePasse({
    agents: [
      { pane: 'w1:p1', contenu: 'texte A' },
      { pane: 'w2:p2', contenu: 'texte B' },
    ],
    maintenant: t,
  });
  assert.equal(premier.memoire.size, 2);

  // Le second pane a été fermé : il n'est plus à l'inventaire du tour suivant.
  const second = unePasse({ agents: [{ pane: 'w1:p1', contenu: 'texte A' }], memoire: premier.memoire, maintenant: t + 60_000 });
  assert.deepEqual([...second.memoire.keys()], ['w1:p1'], 'un pane disparu SORT de la mémoire');

  // Et une boîte qui se vide sort aussi.
  const troisieme = unePasse({ agents: [{ pane: 'w1:p1', contenu: '' }], memoire: second.memoire, maintenant: t + 120_000 });
  assert.equal(troisieme.memoire.size, 0);
  assert.equal(troisieme.decisions[0].cause, 'vide');
});

test('une passe ne MUTE JAMAIS la mémoire qu’on lui donne — sinon un tour rejoué ne dit pas la même chose', () => {
  const memoire = new Map([['w1:p1', { texte: 'texte A', tours: 2, depuis: 1 }]]);
  const gele = JSON.stringify([...memoire]);
  unePasse({ agents: [{ pane: 'w1:p1', contenu: 'texte A' }], memoire, maintenant: 2 });
  assert.equal(JSON.stringify([...memoire]), gele);
});

// ═══ 9. LA FENÊTRE QUE LE BALAYEUR NOMME EST LA SIENNE ══════════════════════════════════

test('le balayeur passe SA fenêtre au geste — et zéro devant un texte COLLÉ', async () => {
  // ⚠️ CET ESSAI NE MESURE PAS LE GESTE, IL MESURE CE QU'ON LUI DIT. C'est le seul endroit où
  // la troisième fenêtre est éprouvée : partout ailleurs le banc la neutralise pour rester
  // court, ce qui la rendrait invisible — un réglage qu'aucun essai ne touche est un réglage
  // qu'on peut remplacer par celui d'un autre chemin sans rien faire rougir. C'est exactement
  // le défaut de T-20260818-0076.
  const vues = [];
  const espion = async ({ immobiliteMs }) => {
    vues.push(immobiliteMs);
    return { ok: false, cause: 'bouge', soumis: false };
  };
  const liste = [
    { pane: 'w1:p1', contenu: 'une phrase tapée à la main' },
    { pane: 'w2:p2', contenu: '[Pasted text #83 +7 lines]' },
  ];
  let memoire = new Map();
  for (let i = 0; i < 3; i += 1) {
    ({ memoire } = await unTourDeBalayage({
      agents: liste,
      lireEcran: async (a) => `────────\n❯ ${liste.find((x) => x.pane === a.pane).contenu}\n────────`,
      delivrer: espion,
      memoire,
      maintenant: 1_000_000 + i * 60_000,
    }));
  }

  assert.deepEqual(
    vues,
    [FENETRE_DU_BALAYAGE_MS, 0],
    'UN TEXTE TAPÉ GARDE LA FENÊTRE DU BALAYAGE ; un texte COLLÉ n’a personne derrière lui, ' +
      'donc rien à observer — et cette règle vit dans `fenetreDImmobilite`, elle n’est pas recopiée ici.'
  );
});

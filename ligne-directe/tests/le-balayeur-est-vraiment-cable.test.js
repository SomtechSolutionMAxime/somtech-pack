// LE CÂBLAGE DU BALAYEUR DANS LE VEILLEUR — et c'est ici qu'on le garde, parce que son absence
// est SILENCIEUSE.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260818-0078)
//
// `balayage.js` porte la logique, et elle est éprouvée chez elle. Mais toutes ses entrées sont
// INJECTÉES, et deux d'entre elles retombent sur un défaut d'apparence inoffensive quand on
// oublie de les brancher :
//
//   • `sousBail` retombe sur `() => false` — un veilleur mal câblé balaie donc les bancs
//     d'essai des autres agents SANS AUCUNE PROTECTION, et rien ne le dit ;
//   • `agents` retombe sur `[]` — un veilleur mal câblé rend des tours parfaitement verts, à
//     zéro pane vu, sur un poste où plus rien n'est balayé.
//
// **Les deux oublis rendent un dispositif qui a l'air de marcher.** C'est exactement le mode de
// panne que ce lot corrige : quelque chose qui s'éteint sans produire d'erreur. Une garde sur la
// logique seule n'attrape ni l'un ni l'autre — il faut regarder LE CÂBLAGE.
//
// ⚠️ ON ÉPROUVE LE VRAI CHEMIN, PAS UN DOUBLE DE MODULE. Le veilleur appelle son propre
// `herdr.agents()`, son propre `herdr.ecranDe()`, son propre `herdr.delivrerLaBoiteDuPane()` et
// sa propre `herdr.remettre()` ; c'est le BINAIRE `herdr` qui est faux, posé en tête du `PATH`.
// Doubler les fonctions du module aurait éprouvé le double, pas le câblage.
//
// ⚠️ ON N'ÉPROUVE PAS ICI CE QUE `balayage.js` ÉPROUVE DÉJÀ. Pas d'ordre des abstentions, pas de
// discriminant collé/tapé : ce fichier ne pose qu'une question — *le veilleur a-t-il branché ce
// qu'il fallait, là où il fallait*.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { posteHerdr } from './aide/faux-herdr.js';

let Veilleur, poserUnBail, CADENCE_DU_BALAYAGE_MS;
let bac, pathOriginal, racineOriginale, maisonOriginale;

// ⚠️ AUCUN ESSAI NE TOUCHE `~/.somtech/ligne-directe` — il porte les lignes VIVANTES du
// dirigeant et, depuis ce lot, les baux du poste. La racine est déplacée AVANT le premier
// import, parce que les modules la lisent au chargement.
before(async () => {
  bac = mkdtempSync(join(tmpdir(), 'ld-cablage-'));
  pathOriginal = process.env.PATH;
  racineOriginale = process.env.LIGNE_DIRECTE_RACINE;
  process.env.LIGNE_DIRECTE_RACINE = join(bac, 'racine');
  // ⚠️ ET LE FOYER AUSSI, POUR DEUX RAISONS DONT UNE SEULE EST LA VITESSE.
  //
  // `socketsHerdr()` découvre les sessions du poste sous `~/.config/herdr/sessions`. Laissé au
  // vrai foyer, ce banc interroge le faux binaire UNE FOIS PAR SESSION RÉELLE — mesuré : onze
  // secondes pour un seul tour, sur un poste qui en portait treize.
  //
  // Mais surtout, et c'est la vraie raison : il ferait dépendre le verdict du banc de l'état du
  // poste au moment où on le lance. **Un banc dont la réponse change selon le nombre de
  // terminaux ouverts ne mesure plus le code — il mesure la machine.** Le foyer jetable rend
  // l'inventaire déterministe : aucune session trouvée, donc un seul appel, donc le faux
  // binaire et lui seul.
  maisonOriginale = process.env.HOME;
  process.env.HOME = bac;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ poserUnBail } = await import('../src/baux.js'));
  ({ CADENCE_DU_BALAYAGE_MS } = await import('../src/delivrance.js'));
});

after(() => {
  process.env.PATH = pathOriginal;
  delete process.env.FAUX_HERDR_ETAT;
  if (racineOriginale === undefined) delete process.env.LIGNE_DIRECTE_RACINE;
  else process.env.LIGNE_DIRECTE_RACINE = racineOriginale;
  if (maisonOriginale === undefined) delete process.env.HOME;
  else process.env.HOME = maisonOriginale;
  rmSync(bac, { recursive: true, force: true });
});

/**
 * Un poste herdr neuf par essai — et le `PATH` du processus lui-même est détourné.
 *
 * ⚠️ `FAUX_HERDR_ETAT` N'EST PAS DÉCORATIF : sans lui le faux binaire meurt avant de jouer son
 * scénario, et tout ce qu'on lit devient « écran illisible », c'est-à-dire une abstention
 * parfaitement plausible. Le banc rendrait alors des refus NOMMÉS au lieu d'une erreur —
 * le mode de panne le plus traître de ce genre de banc.
 */
function poste(nom, agents) {
  const p = posteHerdr(bac, agents, nom);
  process.env.PATH = p.path;
  process.env.FAUX_HERDR_ETAT = p.etat;
  return p;
}

/** Un veilleur nu : ni connexion d'écoute, ni socket. On ne veut que ses méthodes de balayage. */
function veilleurNu(nom) {
  return new Veilleur({ cheminSocket: join(bac, `${nom}.sock`), identite: { equipe: 'T' } });
}

// ⚠️ UN TEXTE COLLÉ, ET C'EST DÉLIBÉRÉ. `fenetreDImmobilite` rend ZÉRO devant un collage — il
// est arrivé d'un seul coup, personne n'a les doigts dessus, il n'y a rien à observer. Un texte
// TAPÉ ferait dormir le banc dix secondes par candidat, et un banc lent ne prouve rien de plus.
// La garde de ce chemin, ce sont les TROIS TOURS, et eux sont éprouvés pour de vrai.
const COLLE = '[Pasted text #7 +3 lines]';

test('LE VEILLEUR BRANCHE `sousBail` — sans ça il soumettrait le banc d’un autre agent en silence', async () => {
  const p = poste('bail', [{ pane_id: 'w9:p1', name: 'cible' }]);
  p.pane('w9:p1', { boite: COLLE });
  // Le pane est réservé : quelqu'un mesure quelque chose dessus, en ce moment même.
  poserUnBail('w9:p1', { minutes: 10, pourquoi: 'banc de mesure' });

  const v = veilleurNu('bail');
  const t0 = Date.now();
  let rendu;
  // Quatre tours : de quoi franchir largement les trois exigés, si le bail ne mordait pas.
  for (let i = 0; i < 4; i += 1) rendu = await v.unTour(t0 + i * 60_000);

  assert.equal(
    p.gestes('w9:p1').filter((a) => a[1] === 'send-keys').length,
    0,
    'UN BAIL NE SE DISCUTE PAS CONTRE CE QU’ON CROIT VOIR À L’ÉCRAN : aucune touche ne part sur un pane réservé'
  );
  assert.equal(rendu.parCause.bail, 1, 'et l’abstention doit être NOMMÉE `bail`, pas fondue dans un autre refus');
  assert.equal(rendu.debloques.length, 0);
});

test('LE VEILLEUR BRANCHE L’INVENTAIRE — un tour à zéro pane vu n’est pas un tour réussi', async () => {
  const p = poste('inventaire', [
    { pane_id: 'w1:p1', name: 'un' },
    { pane_id: 'w2:p2', name: 'deux' },
  ]);
  p.pane('w1:p1', { boite: '' }).pane('w2:p2', { boite: '' });

  const rendu = await veilleurNu('inventaire').unTour();

  // ⚠️ LA GARDE QUI EMPÊCHE CE BANC D'ÊTRE AVEUGLE. Si le veilleur n'avait pas branché son
  // inventaire, `balayage.js` retomberait sur `[]` et ce tour rendrait `vus: 0` — vert, sans
  // avoir rien regardé. C'est « le vert qui ne touche pas ce qu'il éprouve », et ce dépôt l'a
  // déjà payé deux fois.
  assert.equal(rendu.vus, 2, 'le tour doit VOIR les agents que herdr rend — sinon il balaie le vide');
});

test('LE VEILLEUR BRANCHE LA LECTURE, LE GESTE ET L’AVIS — une boîte figée trois tours est délivrée', async () => {
  const p = poste('geste', [{ pane_id: 'w3:p3', name: 'oublie' }]);
  p.pane('w3:p3', { boite: COLLE });

  const v = veilleurNu('geste');
  const t0 = Date.now();
  let rendu;
  for (let i = 0; i < 3; i += 1) rendu = await v.unTour(t0 + i * 60_000);

  assert.equal(rendu.debloques.length, 1, 'après trois tours du même texte, la boîte doit être délivrée');
  assert.equal(rendu.debloques[0].pane, 'w3:p3');
  assert.ok(
    p.gestes('w3:p3').some((a) => a[1] === 'send-keys'),
    'la touche d’envoi doit réellement partir — sinon le veilleur décide sans agir'
  );

  // ⚠️ L'AVIS N'A AUCUN TRANSPORT À LUI, et c'est ce lot qui l'a découvert. Sur les deux autres
  // chemins il est PRÉFIXÉ au message qu'on allait livrer de toute façon ; ici il n'y a pas de
  // message qui suit, donc il voyage seul. Sans ce branchement, la boîte serait délivrée et son
  // auteur n'apprendrait JAMAIS qu'un texte est parti sous sa signature.
  assert.equal(rendu.debloques[0].avis, 'remis', 'l’avis doit être remis, pas perdu');
  const arrive = p.recu('w3:p3') || '';
  assert.match(arrive, /BOÎTE DE SAISIE ÉTAIT BLOQUÉE/i, 'l’agent doit apprendre que sa boîte était bloquée');
  assert.match(
    arrive,
    /balayeur/i,
    'et il doit apprendre PAR QUOI — c’est la seconde moitié du critère, et rien d’autre ne la porte'
  );
});

test('LA MÉMOIRE SE REPORTE D’UN TOUR AU SUIVANT — sans ce report, aucun pane n’atteint jamais trois tours', async () => {
  const p = poste('memoire', [{ pane_id: 'w4:p4', name: 'fige' }]);
  p.pane('w4:p4', { boite: COLLE });

  const v = veilleurNu('memoire');
  const t0 = Date.now();
  const un = await v.unTour(t0);
  const deux = await v.unTour(t0 + 60_000);

  // ⚠️ C'EST LE REPORT QUI FAIT LE COMPTEUR. Un veilleur qui repartirait d'une mémoire neuve à
  // chaque tour tournerait indéfiniment sans jamais rien délivrer — et ne produirait AUCUNE
  // erreur en le faisant. Ce serait le mode de panne du ticket, rejoué dans son correctif.
  assert.equal(un.refus[0].tours, 1, 'premier tour : un passage');
  assert.equal(deux.refus[0].tours, 2, 'second tour : DEUX passages — donc la mémoire a survécu au tour');
});

test('DEUX TOURS NE SE CHEVAUCHENT PAS — la cadence est un intervalle entre tours, pas une horloge', async () => {
  const v = veilleurNu('chevauchement');
  let enCours = 0;
  let maxSimultanes = 0;
  // Un tour LENT : chaque candidat paie sa fenêtre d'immobilité, et sur un poste chargé un tour
  // peut approcher sa propre cadence. Si le minuteur ne s'en souciait pas, deux tours
  // décideraient sur la même boîte — et le second soumettrait ce que le premier vient de voir.
  v.unTour = async () => {
    enCours += 1;
    maxSimultanes = Math.max(maxSimultanes, enCours);
    await new Promise((r) => setTimeout(r, 60));
    enCours -= 1;
    return { debloques: [], refus: [], parCause: {}, memoire: new Map() };
  };

  const minuteur = v.balayer(10);
  await new Promise((r) => setTimeout(r, 200));
  clearInterval(minuteur);

  assert.equal(maxSimultanes, 1, 'jamais deux tours en vol : le second déciderait sur ce que le premier a déjà vu');
});

test('UN TOUR QUI JETTE NE TUE PAS LE BALAYEUR — il doit survivre à son propre échec', async () => {
  const v = veilleurNu('resilience');
  let passages = 0;
  v.unTour = async () => {
    passages += 1;
    throw new Error('herdr injoignable');
  };

  const minuteur = v.balayer(10);
  await new Promise((r) => setTimeout(r, 120));
  clearInterval(minuteur);

  // ⚠️ UN BALAYEUR QUI MEURT AU PREMIER TOUR RATÉ EST PIRE QUE PAS DE BALAYEUR : il a l'air
  // installé. C'est le mode de panne exact que ce lot corrige, et il se réintroduirait ici par
  // la porte du confort — une promesse non rattrapée suffit à éteindre l'intervalle en silence.
  assert.ok(passages >= 2, `le balayeur doit repasser après un tour en échec (${passages} passage(s))`);
});

test('LE BALAYAGE S’ARRÊTE AVEC LE VEILLEUR — un intervalle qui survit à l’arrêt agirait sans maître', async () => {
  const v = veilleurNu('arret');
  let passages = 0;
  v.unTour = async () => {
    passages += 1;
    return { debloques: [], refus: [], parCause: {}, memoire: new Map() };
  };
  // ⚠️ UN SERVEUR FACTICE, ET IL FAUT DIRE POURQUOI. `arreter()` attend la fermeture du socket
  // local ; un veilleur NU n'en a pas, et `this.serveur?.close(resolve)` ne rappelle alors
  // jamais son `resolve` — la promesse reste en vol pour toujours. Mesuré ici, en faisant pendre
  // ce banc. Ce n'est pas un défaut du produit (on n'arrête jamais un veilleur qu'on n'a pas
  // démarré), mais l'éprouver demande de lui rendre la seule chose qu'on lui a retirée.
  v.serveur = { close: (rappel) => rappel() };
  v.balayer(10);
  await new Promise((r) => setTimeout(r, 60));
  await v.arreter();
  const apresArret = passages;
  await new Promise((r) => setTimeout(r, 80));

  assert.equal(passages, apresArret, 'après `arreter()`, plus aucun tour ne doit partir');
});

test('LA CADENCE VIENT DE `delivrance.js`, JAMAIS DU VEILLEUR', async () => {
  // ⚠️ CE N'EST PAS UN ESSAI COSMÉTIQUE. Deux réglages qu'on ne voit jamais ensemble sont deux
  // comportements dont un seul est annoncé — c'est ce qui a coûté T-20260818-0076, où l'on
  // promettait dix secondes pendant qu'un chemin en faisait trois cents. La valeur du balayeur
  // vit auprès des deux fenêtres qu'elle côtoie ; le jour où quelqu'un la recopiera ici « pour
  // aller plus vite », cet essai le lui dira.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/veilleur.js', import.meta.url), 'utf8');
  const sansCommentaires = source.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');

  assert.match(sansCommentaires, /CADENCE_DU_BALAYAGE_MS/, 'le veilleur doit NOMMER la cadence, pas la porter');
  assert.doesNotMatch(
    sansCommentaires,
    /balayer\s*\(\s*cadence\s*=\s*\d/,
    'un chiffre écrit ici serait un second réglage, invisible depuis celui qu’on annonce'
  );
  assert.equal(typeof CADENCE_DU_BALAYAGE_MS, 'number');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QU'UNE PASSE DE REVUE DE FOND A REJETÉ, ET QUI EST GARDÉ ICI
//
// Les trois essais qui suivent n'existaient pas quand ce lot a été soumis. Ils gardent trois
// corrections faites APRÈS un rejet fondé — et sans eux, chacune se laisserait retirer sans
// qu'aucun essai ne rougisse, ce qui est la définition d'une garde qui ne garde rien.

test('UN BAIL POSÉ PENDANT LA FENÊTRE ARRÊTE LA TOUCHE — décider et agir sont deux instants', async () => {
  // ⚠️ UN TEXTE **TAPÉ**, ET C'EST TOUT LE SUJET. Devant un collage, `fenetreDImmobilite` rend
  // zéro : il n'y a pas de fenêtre, donc pas d'intervalle entre la décision et le geste, donc
  // rien à éprouver. C'est précisément parce que le texte tapé ouvre DIX SECONDES entre les deux
  // qu'une passe de revue de fond a rejeté ce lot.
  //
  // ⚠️ ET LE BAIL ARRIVE PENDANT CES DIX SECONDES, PAS AVANT. Une première écriture de cet essai
  // le posait avant le tour décisif : `unePasse` le voyait alors dès la DÉCISION, s'abstenait, et
  // le veto n'était jamais atteint. **L'essai restait vert quand on retirait le veto** — il
  // gardait la garde d'à côté, pas la sienne. C'est le défaut de ce jalon commis dans le
  // correctif d'un rejet qui portait sur ce défaut.
  const p = poste('bail-tardif', [{ pane_id: 'w7:p7', name: 'cible-tardive' }]);
  p.pane('w7:p7', { boite: 'je tape encore ma phrase' });

  const v = veilleurNu('bail-tardif');
  const t0 = Date.now();
  await v.unTour(t0);
  await v.unTour(t0 + 60_000);

  // Le troisième tour décide de délivrer, puis attend. Le bail est posé DEUX SECONDES après le
  // départ du tour — donc après la décision, et bien avant que la touche ne parte.
  const bailTardif = setTimeout(() => poserUnBail('w7:p7', { minutes: 5, pourquoi: 'un banc qui reprend ce pane' }), 2_000);
  const rendu = await v.unTour(t0 + 120_000);
  clearTimeout(bailTardif);

  assert.equal(
    p.gestes('w7:p7').filter((a) => a[1] === 'send-keys').length,
    0,
    'la touche ne doit PAS partir : le pane a été réservé entre la décision et le geste'
  );
  assert.equal(rendu.debloques.length, 0, 'et le tour ne doit pas compter ça comme un déblocage');
  assert.equal(rendu.parCause['plus-autorise'], 1, 'le refus doit être NOMMÉ — un veto muet ne se distingue pas d’un geste raté');
});

test('UNE LECTURE RATÉE NE REMET PAS LE COMPTEUR À ZÉRO — « je n’ai pas vu » n’est pas « ça a changé »', async () => {
  const { unePasse } = await import('../src/balayage.js');
  const t = Date.now();

  // Deux tours vus, puis un tour où la lecture échoue, puis un quatrième.
  let m = new Map();
  ({ memoire: m } = unePasse({ agents: [{ pane: 'w8:p8', contenu: 'fige' }], memoire: m, maintenant: t }));
  ({ memoire: m } = unePasse({ agents: [{ pane: 'w8:p8', contenu: 'fige' }], memoire: m, maintenant: t + 60_000 }));
  const raté = unePasse({ agents: [{ pane: 'w8:p8', contenu: null }], memoire: m, maintenant: t + 120_000 });
  m = raté.memoire;

  assert.equal(raté.decisions[0].cause, 'pas-lue');
  assert.equal(m.get('w8:p8')?.tours, 2, 'le compte doit SURVIVRE à une lecture ratée — sinon la borne se dégrade en silence');

  // ⚠️ ET IL NE GAGNE RIEN NON PLUS : le tour n'a rien constaté. Le pane devient candidat au
  // tour suivant, celui qui l'aura vraiment revu — pas à celui qui ne l'a pas vu.
  const apres = unePasse({ agents: [{ pane: 'w8:p8', contenu: 'fige' }], memoire: m, maintenant: t + 180_000 });
  assert.equal(apres.decisions[0].action, 'delivrer', 'trois lectures RÉUSSIES du même texte : c’est le troisième vrai passage');
});

test('UN TOUR NE DÉLIVRE PAS PLUS QUE SON PLAFOND — et les reportés GARDENT leur candidature', async () => {
  const { unTourDeBalayage } = await import('../src/balayage.js');
  const { DELIVRANCES_PAR_TOUR } = await import('../src/delivrance.js');

  const panes = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => `w9:p${x}`);
  const agents = panes.map((pane) => ({ pane, nom: pane }));
  const gestes = [];
  const t = Date.now();

  let memoire = new Map();
  let rendu;
  for (let i = 0; i < 3; i += 1) {
    rendu = await unTourDeBalayage({
      agents,
      lireEcran: async () => ['x', '─'.repeat(40), `❯ ${COLLE}`, '─'.repeat(40)].join('\n'),
      delivrer: async ({ pane }) => {
        gestes.push(pane);
        return { ok: true, cause: 'soumis', soumis: true, texte: COLLE };
      },
      avertir: async () => ({ ok: true }),
      memoire,
      maintenant: t + i * 60_000,
    });
    memoire = rendu.memoire;
  }

  assert.equal(gestes.length, DELIVRANCES_PAR_TOUR, `un tour ne délivre que ${DELIVRANCES_PAR_TOUR} boîtes`);
  assert.equal(rendu.parCause.reporte, panes.length - DELIVRANCES_PAR_TOUR, 'le reste doit être compté sous `reporte`, jamais tronqué en silence');

  // ⚠️ LA MOITIÉ QUI COMPTE. Un plafond qui rendrait les reportés à zéro les ferait attendre
  // trois tours de plus — il punirait les boîtes oubliées à proportion de leur nombre. Ils
  // doivent être candidats DÈS le tour suivant.
  const suivant = await unTourDeBalayage({
    agents,
    lireEcran: async () => ['x', '─'.repeat(40), `❯ ${COLLE}`, '─'.repeat(40)].join('\n'),
    delivrer: async ({ pane }) => {
      gestes.push(pane);
      return { ok: true, cause: 'soumis', soumis: true, texte: COLLE };
    },
    avertir: async () => ({ ok: true }),
    memoire,
    maintenant: t + 3 * 60_000,
  });
  assert.equal(suivant.debloques.length, DELIVRANCES_PAR_TOUR, 'les reportés sont délivrés au tour suivant, sans repasser par trois tours');
});

test('LES ÉCRANS SE LISENT PAR PAQUETS — en série, un tour dépasse sa propre cadence', async () => {
  const { unTourDeBalayage } = await import('../src/balayage.js');
  const { ECRANS_LUS_DE_FRONT } = await import('../src/delivrance.js');

  // ⚠️ CE QU'ON MESURE ICI EST UN PARALLÉLISME, PAS UNE DURÉE. Un essai qui chronométrerait le
  // tour mesurerait la charge du poste qui l'exécute — c'est exactement le piège que ce lot a
  // rencontré : le même balayage a coûté 0,8 s, puis 68 s, puis 144 s selon ce qui tournait à
  // côté. On compte donc combien de lectures sont EN VOL en même temps : ça, c'est le code.
  let enVol = 0;
  let maxEnVol = 0;
  const agents = Array.from({ length: 40 }, (_, i) => ({ pane: `w1:p${i}`, nom: `a${i}` }));

  await unTourDeBalayage({
    agents,
    lireEcran: async () => {
      enVol += 1;
      maxEnVol = Math.max(maxEnVol, enVol);
      await new Promise((r) => setTimeout(r, 15));
      enVol -= 1;
      return ['x', '─'.repeat(40), '❯ ', '─'.repeat(40)].join('\n');
    },
    delivrer: async () => ({ ok: false, cause: 'sans-effet', soumis: false }),
  });

  assert.ok(
    maxEnVol > 1,
    `les lectures doivent partir de front — une par une, 97 panes ont expiré à deux minutes sur le poste réel (max vu : ${maxEnVol})`
  );
  assert.ok(
    maxEnVol <= ECRANS_LUS_DE_FRONT,
    `et pas toutes d’un coup : lancer un processus par pane sur un poste saturé aggraverait la cause qu’on soigne (max vu : ${maxEnVol})`
  );
});

test('L’ORDRE DES OBSERVATIONS SUIT L’INVENTAIRE — deux comptes rendus doivent se comparer ligne à ligne', async () => {
  const { unTourDeBalayage } = await import('../src/balayage.js');
  const agents = Array.from({ length: 20 }, (_, i) => ({ pane: `w2:p${i}`, nom: `a${i}` }));

  // Des lectures de durées volontairement inégales : sans recomposition ordonnée, les paquets
  // rendraient leurs résultats dans l'ordre où ils finissent, et l'ordre changerait d'un tour
  // à l'autre. On ne pourrait plus lire ce qui a bougé entre deux tours.
  const rendu = await unTourDeBalayage({
    agents,
    lireEcran: async (a) => {
      const rang = Number(a.pane.split('p')[1]);
      await new Promise((r) => setTimeout(r, (7 - (rang % 7)) * 3));
      return ['x', '─'.repeat(40), '❯ ', '─'.repeat(40)].join('\n');
    },
    delivrer: async () => ({ ok: false, cause: 'sans-effet', soumis: false }),
  });

  assert.deepEqual(
    rendu.refus.map((r) => r.pane),
    agents.map((a) => a.pane),
    'l’ordre du compte rendu doit être celui de l’inventaire, pas celui des temps de réponse'
  );
});

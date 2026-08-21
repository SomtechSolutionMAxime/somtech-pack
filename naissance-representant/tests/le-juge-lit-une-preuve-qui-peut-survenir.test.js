// le-juge-lit-une-preuve-qui-peut-survenir.test.js — E-20260821-0001 / T-20260821-0009 · T-20260821-0010
//
// CE QUE CES TESTS GARDENT, ET POURQUOI ILS EXISTENT
//
// Le dispositif de réveil jugeait ses livraisons sur `herdr agent prompt … --wait --until
// working`. **`herdr` ne rend jamais `working`.** Mesuré ici le 2026-08-21, contrôle positif
// inclus : les 83 agents visibles au registre rendent `idle`, tous, sans exception — pendant
// que les fichiers de `~/.claude/sessions` rendent `busy`, `waiting` et `shell` sur le même
// poste, au même instant. Un pane a même été pris en flagrant délit : `w26:p28`, `idle` pour
// `herdr`, `waiting` pour sa session.
//
// La condition ne pouvait donc pas survenir. Le juge ne pouvait pas constater un succès — il
// comptait des vivants pour morts, et il NOYAIT le seul vrai blocage dans ce bruit.
//
// ⚠️ LE PIÈGE QUE CES TESTS DOIVENT EUX-MÊMES ÉVITER — et c'est la moitié de leur raison d'être.
//
// Un juge qui lit une preuve d'activité a DEUX façons de ne rien voir : la source est lisible
// et ne montre pas d'activité, ou LA SONDE EST MUETTE et on n'a rien pu regarder. Les deux
// produisent « pas de preuve », et un test écrit pour l'absence passe parfaitement pendant que
// la mesure est aveugle. C'est exactement le défaut d'origine, sous un autre nom.
//
// D'où le test qui COUPE LA SONDE : il ne vérifie pas qu'on gère l'absence, il vérifie que les
// deux cas rendent des valeurs DIFFÉRENTES. Un correctif où ils se confondent est le défaut
// d'origine réinstallé.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { briefEstPris, commandesLivraison } from '../src/livraison.js';
import { ACTIVITE, etatDeLActivite, identifiantDeSession, lireActivite } from '../src/activite-session.js';

const SEP = '─'.repeat(40);
const ECRAN_VIDE = ['❯ dis H', '⏺ H', SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');

// ═══════════════════════════════════════════════════════════════════════════════════════
// ① LA CONDITION IMPOSSIBLE EST RETIRÉE — T-20260821-0009, critère 1
// ═══════════════════════════════════════════════════════════════════════════════════════

test('aucune commande de livraison ne demande à herdr d’attendre « working »', () => {
  // ⚠️ ON ÉNUMÈRE LES QUATRE COMMANDES, PAS SEULEMENT CELLE QU'ON VIENT DE CORRIGER. Vérifier
  // uniquement `livrer` laisserait la condition impossible réapparaître dans une autre — c'est
  // le motif « une porte sur deux », que ce module a déjà payé six fois.
  for (const options of [{}, { attenteMs: 12345 }, { parLePane: true }, { attenteMs: 999, parLePane: true }]) {
    const c = commandesLivraison('w9:p1', 'mon brief', options);
    for (const [nom, commande] of Object.entries(c)) {
      const plat = commande.join(' ');
      assert.ok(
        !plat.includes('--until'),
        `la commande « ${nom} » porte encore une attente que herdr ne peut pas satisfaire : ${plat}`
      );
      assert.ok(
        !plat.includes('--wait'),
        `la commande « ${nom} » porte encore --wait, dont le témoin (state_change_seq) est mort : ${plat}`
      );
    }
  }
});

test('la livraison passe par le pane ou par l’agent, mais rend la MÊME forme d’appel nu', () => {
  // Le module tient déjà cette doctrine, écrite au-dessus du repli `pane` : « on n'en fabrique
  // pas un faux — la preuve se relit ». Elle n'était appliquée qu'à une branche sur deux.
  const parAgent = commandesLivraison('w9:p1', 'mon brief');
  const parPane = commandesLivraison('w9:p1', 'mon brief', { parLePane: true });
  assert.deepEqual(parAgent.livrer, ['agent', 'prompt', 'w9:p1', 'mon brief']);
  assert.deepEqual(parPane.livrer, ['pane', 'send-text', 'w9:p1', 'mon brief']);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ② LA PREUVE QUI PEUT SURVENIR — T-20260821-0009, critère 2
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un passage du repos au travail vaut prise, même quand herdr n’a rien voulu dire', () => {
  // C'EST LE CAS RÉEL, ET IL ÉTAIT COMPTÉ « NON LIVRÉ » : herdr refuse l'envoi (`stalled`), son
  // statut reste `idle` avant comme après — et le brief est pourtant bien parti. La seule chose
  // qui a changé est l'état de la SESSION, que herdr ne montre pas.
  assert.equal(
    briefEstPris({
      statut: 'idle',
      terminal: ECRAN_VIDE,
      statutAvant: 'idle',
      envoiAccepte: false,
      activiteAvant: ACTIVITE.REPOS,
      activiteApres: ACTIVITE.TRAVAIL,
    }),
    true
  );
});

test('une session qui travaillait DÉJÀ ne prouve rien — le témoin doit avoir pu être différent', () => {
  // La garde que ce module s'est donnée en T-20260814-0138, appliquée au nouveau témoin : un
  // état vrai avant qu'on écrive est vrai quoi qu'on fasse.
  assert.equal(
    briefEstPris({
      statut: 'idle',
      terminal: ECRAN_VIDE,
      statutAvant: 'idle',
      envoiAccepte: false,
      activiteAvant: ACTIVITE.TRAVAIL,
      activiteApres: ACTIVITE.TRAVAIL,
    }),
    false
  );
});

test('une session restée au repos, sonde bien lisible, n’est pas comptée prise sur envoi refusé', () => {
  assert.equal(
    briefEstPris({
      statut: 'idle',
      terminal: ECRAN_VIDE,
      statutAvant: 'idle',
      envoiAccepte: false,
      activiteAvant: ACTIVITE.REPOS,
      activiteApres: ACTIVITE.REPOS,
    }),
    false
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ③ LA SONDE MUETTE NE SE LIT PAS COMME « PAS D'ACTIVITÉ » — T-20260821-0010
// ═══════════════════════════════════════════════════════════════════════════════════════

test('une sonde muette ne vaut pas une preuve de prise', () => {
  // Le symétrique du défaut : compter « pris » ce qu'on n'a pas su regarder serait le même
  // mensonge, retourné. On ne conclut pas d'un silence.
  assert.equal(
    briefEstPris({
      statut: 'idle',
      terminal: ECRAN_VIDE,
      statutAvant: 'idle',
      envoiAccepte: false,
      activiteAvant: ACTIVITE.INDETERMINEE,
      activiteApres: ACTIVITE.INDETERMINEE,
    }),
    false
  );
});

test('les quatre statuts réels de la source se rangent, et un statut inconnu ne se range PAS au repos', () => {
  // Mesurés sur ce poste le 2026-08-21 : idle 143 · waiting 1 · busy 1 · shell 1.
  assert.equal(etatDeLActivite('busy'), ACTIVITE.TRAVAIL);
  assert.equal(etatDeLActivite('waiting'), ACTIVITE.TRAVAIL);
  assert.equal(etatDeLActivite('idle'), ACTIVITE.REPOS);
  assert.equal(etatDeLActivite('shell'), ACTIVITE.REPOS);
  // ⚠️ LE CAS QUI REJOUERAIT LE DÉFAUT. Un statut qu'on ne connaît pas rangé d'office au repos
  // ferait dire « pas d'activité » d'un état qu'on n'a pas su lire — et c'est très exactement
  // ce que `--until working` faisait.
  assert.equal(etatDeLActivite('trépigne'), ACTIVITE.INDETERMINEE);
  assert.equal(etatDeLActivite(null), ACTIVITE.INDETERMINEE);
  assert.equal(etatDeLActivite(undefined), ACTIVITE.INDETERMINEE);
});

// ── Le lien pane → session, sur les deux surfaces de herdr.

test('l’identifiant de session se lit sur la surface « agent » ET sur la surface « pane »', () => {
  // `agent list` ignore une partie du parc ; `pane get` répond pour les mêmes panes. Lire une
  // seule des deux surfaces rendrait la sonde muette précisément sur la population qu'elle vise.
  assert.equal(
    identifiantDeSession({ result: { agent: { agent_session: { value: 'aaa-111' } } } }),
    'aaa-111'
  );
  assert.equal(
    identifiantDeSession({ result: { pane: { agent_session: { value: 'bbb-222' } } } }),
    'bbb-222'
  );
  assert.equal(identifiantDeSession({ result: { pane: {} } }), null);
  assert.equal(identifiantDeSession(null), null);
});

// ── LE TEST QUI COUPE LA SONDE. C'est le critère 4 de l'epic, et il ne se remplace pas par
//    un test d'absence : les deux se ressemblent, et c'est tout le problème.

function racineAvec(sessions) {
  const racine = mkdtempSync(join(tmpdir(), 'sessions-'));
  mkdirSync(racine, { recursive: true });
  for (const [nom, contenu] of Object.entries(sessions)) {
    writeFileSync(join(racine, nom), typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
  }
  return racine;
}

test('COUPER LA SONDE change le résultat — il ne se confond pas avec « rien à montrer »', () => {
  const racine = racineAvec({
    '1.json': { sessionId: 'aaa-111', status: 'idle' },
  });

  // ① LA SONDE VOIT, et ce qu'elle voit est un repos réel. C'est une DÉCISION.
  const vue = lireActivite('aaa-111', { racine });
  assert.equal(vue.etat, ACTIVITE.REPOS);

  // ② LA SONDE EST COUPÉE — la lecture échoue au lieu de rendre un résultat vide.
  const coupee = lireActivite('aaa-111', {
    racine,
    lister: () => {
      throw new Error('sonde coupée');
    },
  });

  // ⚠️ L'ASSERTION QUI COMPTE. Ce n'est pas « coupée rend indéterminée » — c'est que les deux
  // DIFFÈRENT. Un juge où elles se confondent est aveugle sans le savoir, et c'est très
  // exactement le défaut que tout ce lot ferme.
  assert.notEqual(
    coupee.etat,
    vue.etat,
    'la sonde coupée rend la MÊME valeur que la sonde qui voit un repos : la mesure est aveugle'
  );
  assert.equal(coupee.etat, ACTIVITE.INDETERMINEE);
  assert.match(coupee.motif, /sonde coupée|illisible|source/i);
});

test('la sonde coupée se distingue AUSSI d’une session réellement au travail', () => {
  // La coupure doit se séparer des DEUX verdicts possibles, pas seulement du repos — sinon on
  // aurait déplacé la confusion au lieu de la supprimer.
  const racine = racineAvec({ '1.json': { sessionId: 'aaa-111', status: 'busy' } });
  const vue = lireActivite('aaa-111', { racine });
  const coupee = lireActivite('aaa-111', {
    racine,
    lire: () => {
      throw new Error('fichier illisible');
    },
  });
  assert.equal(vue.etat, ACTIVITE.TRAVAIL);
  assert.notEqual(coupee.etat, vue.etat);
  assert.equal(coupee.etat, ACTIVITE.INDETERMINEE);
});

test('les trois façons d’être muet se nomment, et aucune ne se lit comme un repos', () => {
  const racine = racineAvec({ '1.json': { sessionId: 'aaa-111', status: 'idle' } });

  // Pas d'identifiant : on ne sait même pas quoi chercher.
  const sansId = lireActivite(null, { racine });
  assert.equal(sansId.etat, ACTIVITE.INDETERMINEE);

  // Un identifiant qu'aucun fichier ne porte : la source répond, elle ne connaît pas ce pane.
  const sansFichier = lireActivite('zzz-999', { racine });
  assert.equal(sansFichier.etat, ACTIVITE.INDETERMINEE);

  // Une source qui n'existe pas du tout.
  const sansSource = lireActivite('aaa-111', { racine: join(racine, 'nulle-part') });
  assert.equal(sansSource.etat, ACTIVITE.INDETERMINEE);

  // ⚠️ ET LEURS MOTIFS DIFFÈRENT — trois silences de causes distinctes, confondus, sont ce qui
  // a laissé le défaut d'origine vivre des jours dans un journal que personne ne relisait.
  const motifs = new Set([sansId.motif, sansFichier.motif, sansSource.motif]);
  assert.equal(motifs.size, 3, `trois causes, ${motifs.size} motif(s) : elles se confondent`);
});

test('un fichier de session corrompu n’est pas une session au repos', () => {
  const racine = racineAvec({ '1.json': '{ ceci n’est pas du json', '2.json': { sessionId: 'aaa-111', status: 'busy' } });
  // Le fichier illisible ne doit pas faire échouer la lecture des autres — mais il ne doit pas
  // non plus se compter comme un repos.
  assert.equal(lireActivite('aaa-111', { racine }).etat, ACTIVITE.TRAVAIL);
  assert.equal(lireActivite('inconnu', { racine }).etat, ACTIVITE.INDETERMINEE);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ④ LE MÊME DÉFAUT, POSÉ SUR `done` — trouvé en PASSE DE FOND sur ce lot
//
// La garde de T-20260814-0138 dit : **un témoin vrai AVANT qu'on écrive ne prouve rien**. Elle
// était posée sur `working` — et sur `working` SEULEMENT.
//
// Or `done` est un état de départ tout aussi légitime : `ETATS_DISPONIBLES = ['idle', 'done']`,
// et la garde d'entrée de ce module l'accepte explicitement. Un destinataire qui était `done`
// avant l'envoi et qui l'est encore après satisfaisait donc le témoin `statut === 'done'` — un
// état vrai quoi qu'on fasse.
//
// ⚠️ CE N'EST PAS THÉORIQUE. Mesuré sur ce poste le 2026-08-21 : `done` est rendu par
// `agent_status` sur DEUX sessions herdr — 2 agents sur `cg`, 2 sur `progex`. C'est la seule
// valeur autre qu'`idle` que le registre produise, et elle tombait pile dans le trou.
//
// ⚠️ ET LE PIRE CAS EST CELUI OÙ L'OUTIL A DIT LUI-MÊME QUE RIEN N'ÉTAIT PARTI : sur
// `envoiAccepte: false`, boîte encore pleine du texte, `done → done` rendait « pris ».
//
// 🔑 LE MODULE FRÈRE AVAIT DÉJÀ COMMIS ET CORRIGÉ EXACTEMENT ÇA — `ligne-directe/src/boite.js`,
// `laPriseEstConstatee` : « La première écriture acceptait `done → done` comme une sortie de
// l'attente [...] elle aurait donc posé le crochet sur les trois messages perdus. » La leçon
// n'avait pas traversé jusqu'ici. C'est « une porte sur deux », entre deux modules cette fois.
// ═══════════════════════════════════════════════════════════════════════════════════════

const ECRAN_PLEIN = ['❯ dis H', '⏺ H', SEP, '❯ mon texte est encore là', SEP, '  ⏵⏵ auto mode on'].join('\n');

test('un destinataire DÉJÀ « done » ne se prouve pas lui-même — la boîte tranche, pas le statut', () => {
  // Le témoin `statut === 'done'` serait vrai avant même qu'on écrive. Il ne peut donc rien
  // établir : c'est la boîte qui doit trancher, exactement comme pour `working`.
  assert.equal(
    briefEstPris({ statut: 'done', terminal: ECRAN_PLEIN, statutAvant: 'done', envoiAccepte: true }),
    false,
    'la boîte porte encore le texte : rien ne prouve que le brief a été pris'
  );
  // Et le symétrique : la boîte VIDE témoigne, elle, parce qu'elle a pu être différente.
  assert.equal(
    briefEstPris({ statut: 'done', terminal: ECRAN_VIDE, statutAvant: 'done', envoiAccepte: true }),
    true
  );
});

test('sur un envoi que l’outil a REFUSÉ, « done → done » ne vaut surtout pas une prise', () => {
  // ⚠️ LE PIRE CAS. L'appel d'envoi a échoué — rien n'est peut-être parti. Le témoin doit alors
  // être POSITIF et porter sur un état qui pouvait être différent. `done` avant et après n'est
  // ni l'un ni l'autre.
  assert.equal(
    briefEstPris({ statut: 'done', terminal: ECRAN_PLEIN, statutAvant: 'done', envoiAccepte: false }),
    false
  );
  assert.equal(
    briefEstPris({ statut: 'done', terminal: ECRAN_VIDE, statutAvant: 'done', envoiAccepte: false }),
    false,
    'une boîte vide ne prouve rien quand l’outil dit lui-même que rien n’est parti'
  );
});

test('le PASSAGE vers « done » témoigne encore — on ne ferme pas le témoin, on le borne', () => {
  // ⚠️ LA MOITIÉ QUI PROTÈGE. Le correctif ne doit pas rendre `done` inutilisable : un
  // destinataire qui était `idle` et qui est passé à `done` a bel et bien quitté l'attente, et
  // ce passage-là porte sur un état qui pouvait être différent.
  assert.equal(
    briefEstPris({ statut: 'done', terminal: ECRAN_PLEIN, statutAvant: 'idle', envoiAccepte: true }),
    true
  );
  assert.equal(
    briefEstPris({ statut: 'working', terminal: ECRAN_PLEIN, statutAvant: 'idle', envoiAccepte: true }),
    true
  );
});

test('les DEUX états de départ qui rendent le témoin muet sont traités pareil', () => {
  // Ni `working` ni `done` ne peuvent se prouver eux-mêmes. Les traiter différemment, c'est
  // « une porte sur deux » — le motif que ce dépôt a déjà payé six fois.
  for (const depart of ['working', 'done']) {
    assert.equal(
      briefEstPris({ statut: depart, terminal: ECRAN_PLEIN, statutAvant: depart, envoiAccepte: true }),
      false,
      `« ${depart} → ${depart} » ne doit pas se compter comme une prise`
    );
  }
});

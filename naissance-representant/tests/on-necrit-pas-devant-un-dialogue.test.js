// ON N'ÉCRIT PAS DEVANT UN DIALOGUE — la seconde moitié de la garde (T-20260817-0008).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT QUI COMMANDE CE FICHIER, ET IL EST MESURÉ, PAS SUPPOSÉ
//
// Le 2026-08-17, sur le vrai service : un pane affichait `Do you want to proceed? ❯ 1. Yes`,
// proposant d'exécuter une commande. Un `herdr agent prompt <pane> "<texte ordinaire>"` y a été
// envoyé — le geste que fait TOUTE livraison. **La commande a été exécutée.** Le texte n'a pas
// été reçu comme un message : il a servi de CONFIRMATION.
//
// `T-20260816-0114` avait fermé une porte plus étroite — « la touche d'envoi confirme au lieu de
// soumettre » — et sa garde (`ressembleAUnChoix`) ne protège que `delivrerLaBoite`. Ce n'est pas
// seulement la touche d'envoi : **c'est l'écriture elle-même**. La garde posée avant d'écrire ne
// regardait que la BOÎTE, jamais l'ÉCRAN. Un dialogue affiché au-dessus d'une boîte vide passait
// donc entièrement : `contenuBoite === ''`, aucun obstacle, et `agent prompt` partait.
//
// ⚠️ LE REFUS QUI MORDAIT MORDAIT PAR ACCIDENT. Sur le dialogue réellement observé, la boîte
// était ILLISIBLE — donc refusée pour « écran illisible », une raison qui n'est pas la bonne.
// Un garde-fou qui attrape par hasard n'attrape pas : il attend que l'interface change.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LES DUMPS D'ÉCRAN SONT RECOPIÉS DE PANES RÉELS, mesurés le 2026-08-17 sur ce poste, à travers
// 11 sessions et 153 panes. Jamais écrits de mémoire — c'est le point où un double s'écarte le
// plus facilement du service qu'il imite.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LA MOITIÉ QUI PROTÈGE, ET LA RATER TUE LA GARDE
//
// Une garde qui refuse trop rend la ligne du dirigeant inutilisable — une panne PIRE, en
// fréquence, que celle qu'on ferme ; et une garde qui crie sur du bruit cesse d'être lue.
// Les essais du bas exigent donc que les verdicts existants ne bougent PAS d'un cran.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAUSES,
  causeObstacle,
  obstacleAvantLivraison,
  livrerBrief,
  delivrerLaBoite,
} from '../src/livraison.js';

const SEP = '─'.repeat(40);

/** Une boîte de saisie ordinaire, vide et parfaitement lisible. */
const boiteVide = (...avant) => [...avant, SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');
const boiteAvec = (texte, ...avant) => [...avant, SEP, `❯ ${texte}`, SEP, '  ⏵⏵ auto mode on'].join('\n');

// ── LES QUATRE DIALOGUES RÉELS, recopiés tels que `herdr agent read` les a rendus.

/** Le dialogue de PERMISSION — celui qui a fait exécuter une commande (session `cg`, `wE:p1`). */
const DIALOGUE_PERMISSION = [' Blocked by classifier', ' Do you want to proceed?', ' ❯ 1. Yes', '   2. No', ' Esc to cancel · Tab to amend · ctrl+e to explain'];

/** Le dialogue de LIMITE D'USAGE (session `cg`, `w6:p1`). */
const DIALOGUE_LIMITE = ['   What do you want to do?', '   ❯ 1. Stop and wait for limit to reset', '     2. Switch to usage credits', '     3. Switch to Team plan', '   Enter to confirm · Esc to cancel'];

/** Le dialogue des SERVEURS MCP (sessions `cg` et `somtech`, deux panes `idle`). */
const DIALOGUE_MCP = ['  2 new MCP servers found in this project', '  Select any you wish to enable.', '  ❯ [✔] servicedesk', '    [✔] somcraft', ' Space to select · Enter to confirm · Esc to reject all'];

/** Le dialogue de REPRISE DE SESSION (session `progex`, `w1:p1`). */
const DIALOGUE_REPRISE = ['  This session is 3d 23h old and 455.2k tokens.', '  ❯ 1. Resume from summary (recommended)', '    2. Resume full session as-is', '  Enter to confirm · Esc to cancel'];

const TOUS_LES_DIALOGUES = [
  ['permission', DIALOGUE_PERMISSION],
  ['limite d’usage', DIALOGUE_LIMITE],
  ['serveurs MCP', DIALOGUE_MCP],
  ['reprise de session', DIALOGUE_REPRISE],
];

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA PORTE QU'ON FERME

test('un dialogue affiché au-dessus d’une boîte VIDE et LISIBLE est un refus — c’est le trou', () => {
  // Le cas exact du défaut : rien dans la boîte, session disponible, aucun obstacle avant ce
  // lot — et `agent prompt` partait, confirmant l’option surlignée.
  const ecran = boiteVide(...DIALOGUE_PERMISSION);
  assert.equal(causeObstacle(ecran, 'idle'), CAUSES.DIALOGUE);
  const m = obstacleAvantLivraison(ecran, 'idle', { pane: 'w9:p1' });
  assert.ok(m, 'écrire devant un dialogue doit être refusé');
});

test('le refus NOMME le dialogue et dit à qui appartient le geste — sinon il bloque sans lever', () => {
  // Un refus fondé qui laisse son lecteur exactement où il était ne protège plus (T-20260816-0045).
  const m = obstacleAvantLivraison(boiteVide(...DIALOGUE_PERMISSION), 'idle', { pane: 'w9:p1' });
  assert.match(m, /dialogue/i, 'il faut dire CE QUI bloque — un dialogue, pas « la boîte »');
  assert.match(m, /confirm/i, 'et pourquoi : écrire y CONFIRMERAIT l’action affichée');
  assert.match(m, /w9:p1/, 'et où, avec le pane réel — un gabarit non substitué ne s’exécute pas');
});

test('le refus ne se confond PAS avec « boîte illisible » — la bonne raison, pas celle du hasard', () => {
  // Sur le dialogue réel, la boîte est illisible et l’ancien refus mordait pour ça. Le jour où
  // l’interface laissera la boîte lisible, ce refus-là disparaîtra sans que rien ne le signale.
  const m = obstacleAvantLivraison(boiteVide(...DIALOGUE_PERMISSION), 'idle', { pane: 'w9:p1' });
  assert.doesNotMatch(m, /illisible/, 'la cause doit être le dialogue, pas un effet de bord');
});

test('les QUATRE dialogues réels mesurés sur ce poste sont tous reconnus', () => {
  for (const [nom, lignes] of TOUS_LES_DIALOGUES) {
    assert.equal(causeObstacle(boiteVide(...lignes), 'idle'), CAUSES.DIALOGUE, `dialogue « ${nom} » manqué`);
  }
});

test('un dialogue reste un refus même quand la session est « done » — l’écran prime sur le tour', () => {
  assert.equal(causeObstacle(boiteVide(...DIALOGUE_PERMISSION), 'done'), CAUSES.DIALOGUE);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA PREUVE PAR LE FAIT — rien n'est ÉCRIT, et c'est ce qu'on vérifie, pas un code de retour

test('livrerBrief n’envoie AUCUN `agent prompt` devant un dialogue — la preuve est l’absence du geste', async () => {
  const appels = [];
  const resultat = await livrerBrief({
    pane: 'w9:p1',
    texte: 'un compte rendu parfaitement ordinaire',
    appelHerdr: async (commande) => {
      appels.push(commande);
      return { ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' };
    },
    lireEcran: async (commande) => {
      appels.push(commande);
      return boiteVide(...DIALOGUE_PERMISSION);
    },
    dormir: async () => {},
    essais: 2,
    delaiMs: 0,
    pairOccupe: true,
    immobiliteMs: 60000,
  });

  assert.equal(resultat.ok, false, 'la livraison doit échouer, pas réussir silencieusement');
  const ecrits = appels.filter((c) => c[0] === 'agent' && (c[1] === 'prompt' || c[1] === 'send-keys'));
  assert.deepEqual(ecrits, [], `aucune écriture ne doit partir — vu : ${JSON.stringify(ecrits)}`);
});

test('un dialogue au-dessus d’une boîte ENCOMBRÉE ne déclenche pas la délivrance — Entrée y confirmerait', async () => {
  // La délivrance envoie une touche d’envoi, geste IRRÉVERSIBLE. Devant un dialogue, ce serait
  // le pire des deux mondes : le temps d’attente perdu ET l’action approuvée.
  const ecran = boiteAvec('un texte coincé de quelqu’un d’autre', ...DIALOGUE_PERMISSION);
  assert.equal(
    causeObstacle(ecran, 'idle'),
    CAUSES.DIALOGUE,
    'le dialogue prime sur l’encombrement — sinon on tenterait de délivrer devant lui'
  );

  const appels = [];
  const resultat = await livrerBrief({
    pane: 'w9:p1',
    texte: 'un message ordinaire',
    appelHerdr: async (commande) => {
      appels.push(commande);
      return { ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' };
    },
    lireEcran: async (commande) => {
      appels.push(commande);
      return ecran;
    },
    dormir: async () => {},
    essais: 2,
    delaiMs: 0,
    pairOccupe: true,
    immobiliteMs: 60000,
  });
  assert.equal(resultat.ok, false);
  assert.deepEqual(
    appels.filter((c) => c[1] === 'send-keys' || c[1] === 'prompt'),
    [],
    'ni touche d’envoi, ni écriture'
  );
});

test('delivrerLaBoite refuse aussi sur l’ÉCRAN, pas seulement sur le texte coincé', async () => {
  // `ressembleAUnChoix` interroge le CONTENU DE LA BOÎTE. Un dialogue affiché au-dessus d’une
  // boîte qui porte un texte parfaitement ordinaire lui échappe entièrement.
  const appels = [];
  const r = await delivrerLaBoite({
    texteCoince: 'merci, je regarde ça',
    commandes: { lireEcran: ['agent', 'read', 'w9:p1', '--format', 'ansi'], soumettre: ['agent', 'send-keys', 'w9:p1', 'Enter'] },
    appelHerdr: async (c) => {
      appels.push(c);
      return { ok: true };
    },
    lireEcran: async () => boiteAvec('merci, je regarde ça', ...DIALOGUE_PERMISSION),
    dormir: async () => {},
    immobiliteMs: 0,
    essais: 1,
    delaiMs: 0,
  });
  assert.equal(r.ok, false, 'on ne soumet rien devant un dialogue');
  assert.equal(r.soumis, false);
  assert.deepEqual(appels, [], 'aucune touche d’envoi ne doit partir');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA MOITIÉ QUI PROTÈGE — mesurée sur 153 panes réels du poste le 2026-08-17 :
// 5 écrans déclarés « attend un choix », 5 VRAIS dialogues, ZÉRO faux positif, et ZÉRO pane
// livrable perdu sur les 141 qui l'étaient. Ces essais gardent ce chiffre.

test('une LISTE NUMÉROTÉE dans la sortie ordinaire ne fait PAS refuser — c’est ainsi qu’une garde meurt', () => {
  // Mesuré sur le chemin voisin : une première sonde, large, déclarait 3 panes sur 14 « en
  // attente de choix » à tort — tous `idle`, boîte prête, parfaitement joignables. Le
  // resserrement exige un signal ACTIF : le curseur posé sur une option, ou une formule d’invite.
  const compteRendu = boiteVide(
    '⏺ Voici ce que j’ai fait :',
    '  1. lu le ticket',
    '  2. mesuré le faux positif',
    '  3. écrit les essais',
    '✻ Worked for 3m'
  );
  assert.equal(causeObstacle(compteRendu, 'idle'), null, 'un compte rendu numéroté reste livrable');
});

test('un agent qui PARLE d’un dialogue dans sa sortie reste joignable — sinon ce dépôt s’auto-bloque', () => {
  // Les briefs de ce chantier CITENT ces écrans. Une sonde qui mordrait sur la citation
  // rendrait injoignable tout agent à qui l’on parle du défaut — le dispositif censé rendre les
  // blocages visibles en fabriquerait.
  const ecran = boiteVide(
    '⏺ Le ticket décrit un écran qui propose deux options numérotées et attend une réponse.',
    '  J’ai relu la garde : elle ne regardait que la boîte.'
  );
  assert.equal(causeObstacle(ecran, 'idle'), null);
});

test('aucun verdict existant ne bouge — on ajoute une cause, on n’en affaiblit aucune', () => {
  // Un correctif qui rendrait un cas permissif serait pire que le défaut : il rouvrirait la
  // fusion silencieuse que ce module existe pour empêcher.
  assert.equal(causeObstacle(boiteVide(), 'idle'), null, 'une boîte vide ordinaire reste livrable');
  assert.equal(causeObstacle(boiteVide(), 'done'), null);
  assert.equal(causeObstacle(boiteAvec('un reste'), 'idle'), CAUSES.ENCOMBREE);
  assert.equal(causeObstacle(null, 'idle'), CAUSES.ILLISIBLE);
  assert.equal(causeObstacle(boiteVide(), 'working'), CAUSES.STATUT);
  assert.equal(causeObstacle(boiteVide(), 'blocked'), CAUSES.STATUT);
  assert.equal(causeObstacle(boiteVide(), 'working', { pairOccupe: true }), null);
});

test('le STATUT reste la première cause — un pane indisponible ne devient pas « dialogue »', () => {
  // L’ordre des causes est ce que lit l’appelant pour décider quoi tenter. Un pane `blocked`
  // qui affiche un dialogue doit continuer de rendre `statut` : c’est ce que voit `livrer.js`
  // pour savoir qu’il n’y a rien à délivrer.
  assert.equal(causeObstacle(boiteVide(...DIALOGUE_PERMISSION), 'blocked'), CAUSES.STATUT);
});

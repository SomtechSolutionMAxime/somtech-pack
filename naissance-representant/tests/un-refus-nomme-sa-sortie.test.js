// UN REFUS QUI NE NOMME PAS LA SORTIE EST UN REFUS QUI BLOQUE (T-20260816-0045).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT MESURÉ, ET IL EST BRUTAL
//
// Un agent a tenté de joindre son orchestrateur **239 fois**. Chaque refus était JUSTE — la
// boîte de saisie du destinataire contenait un texte collé, et la garde a tenu **288 fois**
// plutôt que de coller les deux messages en un seul que personne n'aurait écrit.
//
// **Aucun de ces 239 refus ne disait quoi faire.** L'expéditeur savait ce qui bloquait ; il
// n'avait aucune idée de ce qui le lèverait, et rien ne le lui disait.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// L'INVARIANT, NOMMÉ — parce qu'une remarque se perd et qu'un invariant se garde
//
//   **UN REFUS QUI NE NOMME PAS LA SORTIE EST UN REFUS QUI BLOQUE.** Il ne protège plus :
//   il remplace un défaut par un autre. Ce qu'il doit dire tient en deux moitiés — CE QUI
//   BLOQUE, avec les valeurs réellement trouvées, et LE GESTE EXACT QUI LE LÈVE, en disant
//   à qui il appartient quand ce n'est pas au lecteur.
//
// Troisième occurrence de la même famille en deux jours : `T-20260816-0001` (« le refus est
// juste, la sortie n'existe pas »), `T-20260816-0002` (« le refus ferme la mauvaise porte et
// laisse l'autre invisible »), et celui-ci.
//
// ⚠️ CE QU'IL NE FAUT SURTOUT PAS FAIRE, ET C'EST LA MOITIÉ QUI PROTÈGE : affaiblir le refus.
// Il a empêché une corruption silencieuse que personne n'aurait vue. **On garde le refus
// entier, on lui ajoute la sortie.** Un correctif qui rend un seul cas permissif est PIRE que
// le défaut — et c'est ce que la section 3 de ce fichier garde.
//
// ⚠️ ET UN REFUS NE PROMET PAS UNE SORTIE QU'IL N'A PAS VÉRIFIÉE. Quand le geste appartient à
// un humain devant ce pane, on le DIT — un aveu explicite vaut infiniment mieux qu'un silence
// qui laisse chercher, et infiniment mieux qu'un conseil inapplicable, qui serait le défaut
// qu'on ferme retourné contre nous.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { obstacleAvantLivraison, livrerBrief } from '../src/livraison.js';

const ecran = (boite) =>
  ['de la sortie', '──────────────', `❯ ${boite}`, '──────────────'].join('\n');
const VIDE = ecran('');
const RESTE = ecran('[Pasted text #137 +19 lines]');
const PANE = 'w0:pB';

// ═════════════════ 1. LES TROIS REFUS NOMMENT LEUR SORTIE

test('LA BOÎTE PLEINE — le refus dit à QUI appartient le geste, et avoue qu’on ne peut pas le faire', () => {
  // Le cas des 239 tentatives. La sortie n'est PAS automatisable : soumettre ou effacer ce
  // texte appartient à quelqu'un devant ce pane. Le dire est la seule réponse honnête — et
  // c'est déjà infiniment plus que ce que le refus disait, c'est-à-dire rien.
  const m = obstacleAvantLivraison(RESTE, 'idle', { pane: PANE });

  assert.match(m, /Pasted text #137/, 'ce qui bloque, avec la valeur réellement trouvée');
  assert.match(m, /coll/, 'et pourquoi le refus est juste — on ne l’affaiblit pas');
  assert.match(m, /soumettre|effacer/i, 'LE GESTE qui lève le blocage');
  assert.match(m, new RegExp(PANE), 'et OÙ il doit être fait — le pane réel, pas une forme');
  assert.match(m, /personne d’autre|à sa place|humain/i, 'à QUI il appartient : pas à l’expéditeur');
});

test('LA BOÎTE ILLISIBLE — le refus dit comment regarder soi-même', () => {
  // Ici la sortie existe et elle est à portée du lecteur : aller voir l'écran. Un refus qui
  // dit « illisible » sans dire comment regarder laisse chercher une commande qui existe.
  const m = obstacleAvantLivraison(null, 'idle', { pane: PANE });

  assert.match(m, /illisible/, 'ce qui bloque');
  assert.match(m, /herdr agent read/, 'LE GESTE — la commande exacte qui montre l’écran');
  assert.match(m, new RegExp(PANE), 'avec le pane réel dedans, pas « <pane> »');
  // ⚠️ RELEVÉ EN REVUE DE FOND, et c'est ce lot retourné contre lui-même : le code lit cet
  // écran en `--format ansi`, parce que le GRIS est la seule chose qui distingue une
  // suggestion d'un reste. Conseiller la commande SANS son option enverrait le lecteur
  // diagnostiquer avec moins que ce qu'on s'accorde à soi-même — un demi-geste.
  assert.match(m, /--format ansi/, 'la commande conseillée est celle que le code utilise lui-même');
});

test('LA SESSION INDISPONIBLE — le refus dit ce qu’on attend et comment le voir venir', () => {
  // Le refus porte sur la PREUVE, pas sur la sûreté : la session a quitté l'attente sans nous.
  // La sortie est d'attendre qu'elle y revienne — et de savoir comment le constater.
  const m = obstacleAvantLivraison(VIDE, 'blocked', { pane: PANE });

  assert.match(m, /blocked/, 'le statut réellement trouvé, pas « autre »');
  assert.match(m, /herdr agent get/, 'LE GESTE — comment voir l’état changer');
  assert.match(m, new RegExp(PANE));
  assert.match(m, /idle|done/, 'et CE QU’ON ATTEND : l’état qui rouvrira la porte');
});

// ═════════════════ 2. LES VALEURS SONT CELLES QU'ON A TROUVÉES, JAMAIS UNE FORME

test('UN AUTRE PANE DONNE UN AUTRE MESSAGE — sinon ce n’est pas une valeur, c’est un gabarit', () => {
  // ⚠️ Un message d'aide générique se copie sans être lu. Celui-ci doit porter ce qu'on a
  // MESURÉ, sinon le lecteur doit encore traduire — et c'est là qu'il abandonne.
  const a = obstacleAvantLivraison(RESTE, 'idle', { pane: 'w4:p1' });
  const b = obstacleAvantLivraison(RESTE, 'idle', { pane: 'w9:pZ' });

  assert.match(a, /w4:p1/);
  assert.match(b, /w9:pZ/);
  assert.ok(!/w9:pZ/.test(a), 'aucun pane emprunté à un autre appel');
});

test('SANS PANE CONNU, ON NE FABRIQUE PAS DE COMMANDE FAUSSE', () => {
  // ⚠️ C'EST LE DÉFAUT QU'ON FERME, RETOURNÉ CONTRE NOUS. Écrire `herdr agent read <pane>`
  // quand on ignore le pane donne une commande que le lecteur ne peut pas exécuter — donc un
  // conseil inapplicable, exactement ce que `T-20260816-0002` reprochait à l'ancien refus.
  // Le refus reste entier ; il se tait sur ce qu'il ne sait pas.
  const m = obstacleAvantLivraison(null, 'idle');

  assert.match(m, /illisible/, 'le refus tient sans le pane');
  assert.ok(!/<pane>/.test(m), 'aucun gabarit non substitué');
  assert.ok(!/herdr agent read\s*$/m.test(m), 'aucune commande tronquée');
});

// ═════════════════ 3. LE REFUS RESTE ENTIER — la moitié qui protège

test('AUCUNE SORTIE N’OUVRE LA PORTE — les trois cas refusent toujours', () => {
  // ⚠️ LA GARDE DE CE LOT. Un correctif qui rendrait un cas permissif serait PIRE que le
  // défaut : il rouvrirait la fusion silencieuse de deux textes en un message que personne
  // n'a écrit. On ajoute des mots, on ne change pas un seul verdict.
  assert.ok(obstacleAvantLivraison(RESTE, 'idle', { pane: PANE }), 'boîte pleine : toujours refusé');
  assert.ok(obstacleAvantLivraison(null, 'idle', { pane: PANE }), 'boîte illisible : toujours refusé');
  assert.ok(obstacleAvantLivraison('', 'idle', { pane: PANE }), 'écran vide : illisible, toujours refusé');
  assert.ok(obstacleAvantLivraison(VIDE, 'blocked', { pane: PANE }), 'statut indisponible : toujours refusé');
  assert.ok(obstacleAvantLivraison(VIDE, 'unknown', { pane: PANE }));
  assert.ok(obstacleAvantLivraison(VIDE, null, { pane: PANE }));
  assert.ok(obstacleAvantLivraison(VIDE, 'working', { pane: PANE }), 'session déjà au travail : toujours refusé');
});

test('LE CAS NOMINAL NE CHANGE RIEN — une boîte vue vide livre, sans message', () => {
  // La sortie ajoutée ne doit exister que sur le chemin du refus. Un `null` qui deviendrait
  // une chaîne ferait refuser toutes les livraisons du poste.
  assert.equal(obstacleAvantLivraison(VIDE, 'idle', { pane: PANE }), null);
  assert.equal(obstacleAvantLivraison(VIDE, 'done', { pane: PANE }), null);
  assert.equal(obstacleAvantLivraison(VIDE, 'idle'), null, 'et sans pane non plus');
});

test('LE PAIR OCCUPÉ RESTE ADMIS — la porte ouverte par T-20260814-0138 ne se referme pas', () => {
  // Un pair est vivant et occupé la plupart du temps. Refermer cette porte laisserait tout le
  // monde sur le geste nu, qui est le défaut d'origine.
  assert.equal(obstacleAvantLivraison(VIDE, 'working', { pane: PANE, pairOccupe: true }), null);
});

// ═════════════════ 3-bis. ET LA SORTIE ARRIVE VRAIMENT JUSQU'À CELUI QUI LIVRE

test('LE REFUS RENDU PAR LA LIVRAISON PORTE LE PANE RÉEL — sinon la sortie est muette en production', async () => {
  // ⚠️ LA GARDE QUI MANQUAIT LE PLUS. `obstacleAvantLivraison` sait écrire la sortie, mais
  // elle ne le fait QUE si son appelant lui passe le pane. Oublier de le passer laisserait
  // tous les essais unitaires ci-dessus verts pendant que l'expéditeur réel — celui des 239
  // tentatives — recevrait encore un refus sans geste.
  const ECRAN = ['s', '──────────', '❯ [Pasted text #137]', '──────────'].join('\n');
  const r = await livrerBrief({
    pane: 'w0:pB',
    texte: 'un compte rendu',
    appelHerdr: async () => ({ ok: true, reponse: { result: { agent: { agent_status: 'done' } } } }),
    lireEcran: async () => ECRAN,
    dormir: async () => {},
    essaisDisponible: 1,
  });

  assert.equal(r.ok, false, 'la livraison refuse, comme avant');
  assert.match(r.message, /Pasted text #137/, 'ce qui bloque');
  assert.match(r.message, /w0:pB/, 'ET où le geste doit être fait — le pane réel');
  assert.match(r.message, /soumettre|effacer/i, 'ET le geste lui-même');
});

// ═════════════════ 4. CE QUE LE REFUS NE PROMET PAS

test('LE REFUS NE PROMET AUCUNE FILE D’ATTENTE — ce point est NON ÉTABLI et le reste', () => {
  // ⚠️ Le ticket marque `[non établi]` : existe-t-il une file exploitable pour un agent `done`
  // dont la boîte est pleine ? Le mesurer exigerait d'écrire dans la boîte de quelqu'un pour
  // voir ce qui arrive — c'est exactement ce qu'on se refuse. Il reste donc non mesuré, et un
  // refus n'annonce pas un mécanisme que personne n'a vu marcher.
  const m = obstacleAvantLivraison(RESTE, 'done', { pane: PANE });

  assert.ok(!/file d’attente|mis en file|sera livré plus tard/i.test(m),
    'aucune promesse de file : ce comportement n’a jamais été mesuré dans ce cas');
});

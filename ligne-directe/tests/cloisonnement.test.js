// QUI EST DANS LE CANAL — le jugement, séparé du transport (T-20260813-0074, T-20260814-0142).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LES DEUX TROUS, ET LEUR CAUSE COMMUNE
//
// `T-20260813-0074` — deux clients dans un même canal de gestionnaire : les deux sont
// autorisés (une ligne cliente autorise PAR APPARTENANCE au canal), les deux lisent tout, et
// rien ne le détecte. Loi 25 : une communication d'affaires d'un client lue par un autre.
//
// `T-20260814-0142` — un client dans un canal d'orchestrateur, où passent les arbitrages, les
// pannes de production, les échéances et les coûts. Le dirigeant a posé la règle ; rien ne la
// faisait respecter.
//
// Cause unique : **le cloisonnement tenait au canal, jamais à ses membres.** `membresDuCanal`
// existait dans `slack.js` et n'était appelé nulle part dans le chemin de pose.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LE CRITÈRE QUE LES DEUX TICKETS PROPOSAIENT N'EXISTE PAS — MESURÉ LE 2026-08-15
//
// Ils tenaient pour acquis que le domaine du courriel serait « disponible dans le profil
// Slack ». Interrogé avec le jeton du ROBOT — celui qui fait la vérification, pas celui du
// dirigeant — `users.info` ne rend AUCUN courriel : le droit `users:read.email` n'est pas
// accordé à notre application. Le profil s'arrête à `real_name`, `display_name`, `title`,
// `phone`, `status_*`.
//
// **Coder le critère du domaine aurait produit une garde qui ne se déclenche jamais** — la
// pire espèce, puisqu'elle rassure.
//
// CE QUI EXISTE, ET QUI VAUT MIEUX, relevé sur les canaux réels du poste :
//
//   #modifications-bruno-2026 (interne) → maxime · Bruno Potvin · robot   — aucun invité
//   #charles-olivier-suivi-client (client) → maxime · robot · Charles-Olivier [INVITÉ]
//                                            · Max perso [INVITÉ][MONO-CANAL]
//
// Slack marque les gens du client `is_restricted` ; les nôtres ne le sont pas. Le statut que
// l'espace de travail accorde est plus solide que l'adresse que quelqu'un porte.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// L'ARBITRAGE, RÉVISÉ PAR L'ORCHESTRATEUR APRÈS CETTE MESURE
//
//   • `T-20260814-0142` passe d'AVERTIR à REFUSER — le signal est fiable, et un invité n'a
//     rien à faire dans un canal d'orchestrateur ;
//   • `T-20260813-0074` : l'avertissement est RETIRÉ — il frapperait le cas nominal, deux
//     personnes d'un même client étant la situation normale. À la place, on PHOTOGRAPHIE les
//     membres et on signale l'arrivée d'un NOUVEAU. Aucune identité requise, et ça attrape le
//     vrai risque : celui qu'on invite des mois plus tard sans se souvenir de ce que le canal
//     porte.
//
// Savoir QUI appartient à QUI attend le registre des personnes (`D-20260806-0016`).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { etrangersParmi, nouveauxVenus, referenceComparable, NOUS } from '../src/cloisonnement.js';

/** Un profil tel que `users.info` le rend — réduit à ce dont le jugement a besoin. */
const gens = (nom, sur = {}) => ({ id: `U_${nom}`, nom, robot: false, invite: false, equipe: NOUS_EQUIPE, ...sur });
const NOUS_EQUIPE = 'T_SOMTECH';

const MAXIME = gens('maxime');
const BRUNO = gens('bruno');
const ROBOT = gens('ligne_directe', { robot: true });
const CLIENT = gens('charles-olivier', { invite: true });
const CLIENT_MONO = gens('max-perso', { invite: true, monoCanal: true });
const AUTRE_ORG = gens('quelqu-un-dailleurs', { equipe: 'T_AUTRE' });

// ═════════════════ 1. QUI EST ÉTRANGER À LA MAISON

test('UN INVITÉ EST UN ÉTRANGER — c’est ainsi qu’un client entre dans notre espace', () => {
  // Le fait mesuré : les deux personnes du client, dans le canal client réel, portent cette
  // marque. Les deux Somtech présents dans des canaux internes ne la portent pas.
  const etrangers = etrangersParmi([MAXIME, ROBOT, CLIENT], NOUS_EQUIPE);
  assert.deepEqual(etrangers.map((e) => e.nom), ['charles-olivier']);
});

test('UN MEMBRE D’UNE AUTRE ORGANISATION AUSSI — c’est l’autre façon dont un externe arrive', () => {
  const etrangers = etrangersParmi([MAXIME, ROBOT, AUTRE_ORG], NOUS_EQUIPE);
  assert.deepEqual(etrangers.map((e) => e.nom), ['quelqu-un-dailleurs']);
});

test('LE ROBOT N’EST JAMAIS UN ÉTRANGER — il est dans tous les canaux par construction', () => {
  assert.deepEqual(etrangersParmi([ROBOT], NOUS_EQUIPE), []);
});

test('DES COLLÈGUES NE DÉCLENCHENT RIEN — sinon la garde devient du bruit et cesse d’être lue', () => {
  // RA-REL-008. C'est le cas nominal des 18 canaux internes du poste : le dirigeant, le robot,
  // parfois un collègue. Une garde qui parle là n'est plus lue quand elle parle ailleurs.
  assert.deepEqual(etrangersParmi([MAXIME, BRUNO, ROBOT], NOUS_EQUIPE), []);
});

// ═════════════════ 1 bis. LES DEUX CÔTÉS DE LA COMPARAISON PORTENT-ILS LA MÊME UNITÉ ?
//
// ⚠️ LA GARDE LOCALE POSÉE PAR `T-20260818-0046`, et la raison d'être de ces trois essais.
//
// Le défaut n'était pas un critère mal choisi : c'était le NOM de l'espace comparé par égalité
// aux IDENTIFIANTS que portent les profils. Deux grandeurs qu'on croit comparables parce
// qu'elles s'appellent pareil. Corriger le champ répare le fait ; **rien n'empêche de le
// recasser** — sauf ceci, qui exige que la référence ait la FORME d'un identifiant.
//
// ⚠️ ET L'ABSTENTION N'EST PAS UN ACQUITTEMENT. Une référence inutilisable ne rend ni « tous
// des nôtres » ni « tous étrangers » : le critère de l'invité continue de mordre, et c'est lui
// qui attrape le cas réel du poste. `veilleur.js` journalise en plus au démarrage — une garde
// qui ne peut plus juger doit le dire.

test('UNE RÉFÉRENCE QUI EST UN NOM N’EST PAS COMPARABLE — c’est le défaut du 2026-08-18, gardé', () => {
  assert.equal(referenceComparable('Somtech Solution'), false, 'un nom d’espace n’est pas un identifiant');
  assert.equal(referenceComparable('T091JB7AVJ4'), true, 'mesuré contre le vrai Slack le 2026-08-18');
  assert.equal(referenceComparable('E091JB7AVJ4'), true, 'et une grille Enterprise en rend un aussi');
  assert.equal(referenceComparable(null), false);
});

test('COMPARÉE À UN NOM, LA GARDE NE CLASSE PERSONNE ÉTRANGER — 100 % de faux refus, mesuré', () => {
  // LE FAIT, rejoué : `identite()` rendait le nom, `users.info` rend l'identifiant, et TOUT
  // membre de l'espace tombait du mauvais côté — le dirigeant compris, sur sa propre ligne.
  const etrangers = etrangersParmi([MAXIME, BRUNO, ROBOT], 'Somtech Solution');
  assert.deepEqual(etrangers, [], 'aucun d’eux n’est un étranger, et une unité illisible ne l’invente pas');
});

test('MAIS L’INVITÉ RESTE ATTRAPÉ — s’abstenir sur l’organisation n’acquitte pas le reste', () => {
  const etrangers = etrangersParmi([MAXIME, ROBOT, CLIENT, AUTRE_ORG], 'Somtech Solution');
  assert.deepEqual(etrangers.map((e) => e.nom), ['charles-olivier'], 'l’invité oui, l’autre organisation non');
});

test('SANS ÉQUIPE DE RÉFÉRENCE, ON NE JUGE PERSONNE SUR SON ORGANISATION — mais l’invité reste un invité', () => {
  // ⚠️ On ne fabrique pas un verdict à partir d'une comparaison qu'on ne peut pas faire.
  // Sans savoir quelle équipe est la nôtre, `equipe` ne dit rien — le reste tient quand même.
  const etrangers = etrangersParmi([MAXIME, AUTRE_ORG, CLIENT], null);
  assert.deepEqual(etrangers.map((e) => e.nom), ['charles-olivier']);
});

// ═════════════════ 2. QUI EST ARRIVÉ DEPUIS LA PHOTO

test('UN MEMBRE ABSENT DE LA PHOTO EST UN NOUVEAU VENU — c’est tout ce qu’on prétend savoir', () => {
  // L'arbitrage révisé : aucune identité requise. On ne dit pas « c'est un autre client », on
  // dit « quelqu'un est entré depuis, et ce canal porte des affaires ». C'est vérifiable, et
  // c'est le vrai risque — on invite des mois plus tard sans se souvenir de ce que le canal
  // contient.
  const photo = [MAXIME.id, ROBOT.id, CLIENT.id];
  const venus = nouveauxVenus(photo, [MAXIME, ROBOT, CLIENT, CLIENT_MONO]);
  assert.deepEqual(venus.map((v) => v.nom), ['max-perso']);
});

test('UN DÉPART N’EST PAS UNE ARRIVÉE — on ne signale que ce qui augmente le lectorat', () => {
  const photo = [MAXIME.id, ROBOT.id, CLIENT.id];
  assert.deepEqual(nouveauxVenus(photo, [MAXIME, ROBOT]), []);
});

test('SANS PHOTO, PERSONNE N’EST UN NOUVEAU VENU — une ligne d’avant ce contrôle ne crie pas au loup', () => {
  // ⚠️ Le registre survit aux versions du pack et rien ne migre. Les lignes déjà ouvertes
  // n'ont pas de photo : les lire comme « tout le monde vient d'arriver » ferait crier chaque
  // ligne du poste au premier message, ce qui est la façon la plus sûre de rendre le signal
  // inaudible avant qu'il ait servi une seule fois.
  assert.deepEqual(nouveauxVenus(null, [MAXIME, ROBOT, CLIENT]), []);
  assert.deepEqual(nouveauxVenus(undefined, [MAXIME, CLIENT]), []);
});

test('LE ROBOT N’EST JAMAIS UN NOUVEAU VENU — il entre au canal avant tout le monde', () => {
  assert.deepEqual(nouveauxVenus([MAXIME.id], [MAXIME, ROBOT]), []);
});

// ═════════════════ 3. CE QUE LE JUGEMENT NE PRÉTEND PAS SAVOIR

test('LA LIMITE DU CRITÈRE EST PORTÉE PAR LE MODULE, pas laissée à qui lira le message', () => {
  // Un critère dont la limite n'est écrite nulle part finit par être pris pour une certitude.
  // Celui-ci en a deux, et elles sont réelles : un externe promu membre plein ne serait pas
  // vu ; un collègue entré comme invité serait signalé à tort.
  assert.match(NOUS.limite, /membre plein/i);
  assert.match(NOUS.limite, /invité/i);
});

// les-dates-disent-ce-quelles-datent.test.js — TROIS DATES, ET CE QU'ELLES DATENT VRAIMENT.
// (D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE BANC EXISTE — TROIS DÉFAUTS D'UNE MÊME FAMILLE
//
// Ce dispositif tient DEUX dates sur chaque agent régulier — celle que sa déclaration inscrit
// (`ne_le`) et celle que son transcrit porte (la naissance de sa session) — et il ne les
// comparait JAMAIS. Il lisait par ailleurs UNE date sur un fichier sans que rien ne dise
// LAQUELLE des trois que `stat` rend. Les trois essais de ce fichier ferment cette famille :
//
//   ① UNE DÉCLARATION NE COUVRE PAS UN AGENT NÉ APRÈS ELLE. Reprendre un pane dans le MÊME
//      worktree — le geste que le pack prescrit (`claude-swt <horodatage>`) — faisait hériter
//      au successeur l'identité de son prédécesseur : la clé primaire n'exigeait que
//      `pane === pane && session === session && même espace`, et les trois termes coïncident
//      exactement quand on reprend son propre terminal dans son propre arbre.
//
//   ② UN ANGLE MORT SE DIT. Le balayage des transcrits COMPTE les répertoires qu'il n'a pas pu
//      ouvrir, et la raison rendue affirmait pourtant « aucun transcrit ne date la session X »
//      — une absence qu'il n'avait pas mesurée.
//
//   ③ LA DATE LUE EST UNE DATE DE CRÉATION. `mtime` d'un transcrit vivant, c'est « la dernière
//      fois que l'agent a parlé » : tout le parc daterait d'aujourd'hui, et la borne de
//      population s'effondrerait vers le bruyant sans qu'un seul essai rougisse.
//
// ⚠️ AUCUNE DATE N'EST RECOPIÉE À LA MAIN DANS CE FICHIER. Elles varient toutes avec la
// machine — le fuseau, l'horloge, le système de fichiers. On les demande à celui qui les
// calcule (`stat`, le producteur de la déclaration) et on RAISONNE dessus. Un banc de ce lot a
// déjà rougi en CI pour avoir épinglé une frontière à l'heure locale de son auteur.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync, readdirSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { lireLesNaissances } from '../src/naissances-des-sessions.js';
import { inscrireLaDeclaration, lireLesDeclarations } from '../src/declaration.js';
import { nomDeSession } from '../src/session.js';
import {
  naissanceDeLAgent,
  normaliserLeParc,
  jugerLeParc,
  couvertureDeLaDeclaration,
  TOLERANCE_DE_DATATION_MS,
  VERDICTS,
  SOURCES,
} from '../src/garde-des-naissances.js';

const PANE = 'w97:p2';
const ESPACE = '/bac/worktrees/un-depot/20260825-101721';
const socketDe = (nom) => `/Users/qui-que-ce-soit/.config/herdr/sessions/${nom}/herdr.sock`;

const paneDe = (valeur, sur = {}) => ({
  agent: true,
  pane_id: 'w1:p1',
  agent_session: valeur === null ? null : { agent: 'claude', kind: 'id', source: 'herdr:claude', value: valeur },
  ...sur,
});

function bacTranscrits(projets) {
  const racine = mkdtempSync(join(tmpdir(), 'dates-'));
  for (const [projet, sessions] of Object.entries(projets)) {
    mkdirSync(join(racine, projet), { recursive: true });
    for (const s of sessions) writeFileSync(join(racine, projet, `${s}.jsonl`), '{}\n');
  }
  return racine;
}

/** Le temps passe VRAIMENT — `utimesSync` et `mtime` ont besoin d'un écart réel, pas simulé. */
function laisserPasser(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { /* le poste tourne */ }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ③ LA SONDE LIT UNE DATE DE CRÉATION — jamais une date de dernière écriture
//
// 🔴 MESURÉ : la mutation `birthtimeMs → mtimeMs`, vérifiée appliquée, laissait **779 essais
// verts sur 779**. C'était la SEULE ligne du lot dont le comportement dépende du système de
// fichiers, et son choix de champ n'était éprouvé nulle part.
//
// ⚠️ CES ESSAIS GARDENT LA FONCTION, PAS LA CHAÎNE `birthtimeMs`. Ils ne cherchent aucun mot
// dans la source : ils font DIVERGER les trois dates d'un vrai fichier et exigent que la sonde
// rende celle de la création. Une reformulation légitime (`statSync(f).birthtime.getTime()`)
// les laisse verts ; un changement de champ les fait rougir.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 ③ LA DATE LUE EST CELLE DE LA CRÉATION — pas celle de la dernière écriture, pas celle du dernier changement', () => {
  const racine = bacTranscrits({ '-un-projet': ['aaa-111'] });
  try {
    const f = join(racine, '-un-projet', 'aaa-111.jsonl');
    // On écarte les trois dates du fichier les unes des autres : `ctime` bouge de ce qu'on
    // laisse passer, `mtime` d'un an. Poser `mtime` dans le FUTUR est nécessaire — le poser
    // dans le passé ferait reculer `birthtime` avec lui (APFS), donc effacerait la question.
    laisserPasser(40);
    utimesSync(f, new Date(), new Date(Date.now() + 365 * 24 * 3600 * 1000));

    const st = statSync(f);
    // ⚠️ LE BAC S'ÉPROUVE LUI-MÊME AVANT D'ÉPROUVER LA SONDE. Sans ces trois écarts, les
    // assertions ci-dessous passeraient sur un fichier où les dates sont confondues — un banc
    // qui ne peut pas échouer.
    assert.ok(st.mtimeMs - st.birthtimeMs > 60_000, 'le bac ne distingue pas création et dernière écriture');
    assert.ok(st.ctimeMs - st.birthtimeMs > 1, 'le bac ne distingue pas création et dernier changement');

    const n = lireLesNaissances([paneDe('aaa-111')], { racine });
    const lu = n.instants.get('aaa-111');
    assert.equal(
      lu,
      st.birthtimeMs,
      'la sonde ne rend pas la date de CRÉATION du transcrit — or c’est elle, et elle seule, ' +
        'qui date la naissance de l’agent'
    );
    assert.notEqual(lu, st.mtimeMs, '`mtime` d’un transcrit vivant, c’est « la dernière fois que l’agent a parlé »');
    assert.notEqual(lu, st.ctimeMs, '`ctime` bouge au premier changement de métadonnée');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 ③ … ET ELLE NE BOUGE PAS QUAND L’AGENT PARLE ENCORE — sinon tout le parc daterait d’aujourd’hui', () => {
  const racine = bacTranscrits({ '-un-projet': ['aaa-111'] });
  try {
    const f = join(racine, '-un-projet', 'aaa-111.jsonl');
    const avant = lireLesNaissances([paneDe('aaa-111')], { racine }).instants.get('aaa-111');

    // L'agent parle : son transcrit grossit. Rien de sa NAISSANCE n'a changé.
    laisserPasser(20);
    appendFileSync(f, '{"il":"parle"}\n');
    const st = statSync(f);
    assert.ok(st.mtimeMs > avant, 'le bac n’a pas fait parler l’agent : sa dernière écriture n’a pas bougé');

    const apres = lireLesNaissances([paneDe('aaa-111')], { racine }).instants.get('aaa-111');
    assert.equal(
      apres,
      avant,
      'la naissance d’un agent a bougé parce qu’il a parlé — c’est-à-dire que tout le parc naît ' +
        'aujourd’hui, et que la borne de population ne borne plus rien'
    );
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ② L'ANGLE MORT SE DIT DANS LA RAISON — le consommateur, pas seulement le producteur
//
// 🔴 `illisibles` était produit, documenté et ÉPINGLÉ chez le producteur — et consommé nulle
// part. `naissanceDeLAgent` rendait invariablement « aucun transcrit ne date la session X »,
// c'est-à-dire qu'il affirmait une ABSENCE qu'il n'avait pas mesurée : le transcrit pouvait
// être dans le répertoire qu'on n'a pas su ouvrir. L'opérateur était envoyé chercher un
// fichier manquant alors que la cause était un répertoire fermé.
//
// C'est exactement le partage que le module tient UNE COUCHE PLUS BAS pour le registre des
// déclarations (« un fait abîmé peut être celui de cet agent-ci ») et qu'il n'a pas tenu pour
// le sien.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 ② LA RAISON DIFFÈRE SELON QU’IL Y A UN ANGLE MORT OU NON — sinon elle affirme une absence non mesurée', () => {
  const pane = paneDe('bbb-222');
  const sans = naissanceDeLAgent(pane, { mesure: 'lue', instants: new Map(), illisibles: 0 });
  const avec = naissanceDeLAgent(pane, { mesure: 'lue', instants: new Map(), illisibles: 7 });

  assert.equal(sans.mesure, 'refusée');
  assert.equal(avec.mesure, 'refusée');
  // ⚠️ ON N'ÉPINGLE AUCUNE TOURNURE — on exige que les deux situations ne se disent pas de la
  // même façon. Une reformulation légitime laisse cet essai vert ; un consommateur qui jette
  // à nouveau le compte le fait rougir.
  assert.notEqual(
    avec.raison,
    sans.raison,
    'la raison est la MÊME avec et sans angle mort : elle affirme une absence qu’elle n’a pas mesurée'
  );
  assert.match(avec.raison, /\b7\b/, 'le lecteur doit savoir COMBIEN de zones lui échappent');
});

test('🔴 ② LA JOINTURE, SUR LA VRAIE CHAÎNE — un répertoire fermé sur le disque change ce que le rendu dit', () => {
  const racine = bacTranscrits({ '-ferme': [], '-ouvert': ['aaa-111'] });
  try {
    const panes = [paneDe('bbb-222', { pane_id: PANE, foreground_cwd: ESPACE, herdr_socket: socketDe('somtech') })];
    const ferme = (d) => {
      if (d.endsWith('-ferme')) throw new Error('EACCES: permission denied');
      return readdirSync(d);
    };

    const avecAngleMort = lireLesNaissances(panes, { racine, lister: ferme });
    const sansAngleMort = lireLesNaissances(panes, { racine });
    assert.equal(avecAngleMort.illisibles, 1, 'le producteur doit compter le répertoire fermé');
    assert.equal(sansAngleMort.illisibles, 0);

    const rendu = (naissances) =>
      jugerLeParc({
        agents: normaliserLeParc({ panes, naissances, agentsHerdr: [] }),
        registre: { declarations: [], illisibles: [] },
        portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
      });

    const a = rendu(avecAngleMort);
    const b = rendu(sansAngleMort);
    assert.equal(a.verdict, VERDICTS.ZONES_NON_MESUREES, 'un agent qu’on n’a pas su dater n’est pas vert');
    assert.notEqual(
      a.texte,
      b.texte,
      'le rendu est identique qu’un répertoire ait été fermé ou non : l’angle mort meurt chez le producteur'
    );
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ① UNE DÉCLARATION NE COUVRE PAS UN AGENT NÉ APRÈS ELLE
//
// 🔴 LE SYMÉTRIQUE QUE LE CORRECTIF PRÉCÉDENT A OUVERT. Le banc de la reprise éprouve « même
// pane, même session, worktree NEUF » — et rien d'autre. Reprendre le worktree, c'est reprendre
// l'espace ; le reprendre depuis le terminal où l'on était, c'est reprendre le pane. Les trois
// termes de la clé coïncident alors, et la garde donnait au successeur la déclaration de son
// prédécesseur, sans qu'aucun des deux chiffres de contrôle ne puisse le voir.
//
// ⚠️ LA SYMÉTRIE EST RÉELLE, ET ELLE EST MESURÉE. La déclaration est inscrite QUELQUES SECONDES
// APRÈS la naissance de l'agent — le geste vérifie par le fait, puis inscrit. Une comparaison
// stricte ferait donc de tout agent régulier une prise. Ce que la tolérance doit absorber n'est
// pas ce délai-là (2,0 s mesurés sur la déclaration du poste) mais le RETARD DE LA MESURE : le
// transcrit d'une session naît après son premier événement. Mesuré le 2026-08-25 sur les 121
// transcrits du poste qui datent une vraie conversation : médiane 19,5 s, p90 118 s, **maximum
// 2 208,8 s (36,8 min)**. Voir `TOLERANCE_DE_DATATION_MS`.
//
// ⚠️ ET AU-DELÀ DE LA TOLÉRANCE, LA DÉCLARATION EST « REFUSÉE », JAMAIS « ABSENTE ». Les deux
// lectures restent ouvertes — un successeur, ou l'agent déclaré dont la mesure retarde — et le
// module a déjà un mot pour ça : NON MESURÉ, sortie 2. Le ranger en PRISE nommerait un fautif
// sur une mesure qui ne tranche pas ; le ranger en IDENTIFIÉ est le défaut qu'on ferme.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** La déclaration RÉELLE, écrite par la chaîne du producteur — sa date n'est pas inventée. */
function leProducteurInscrit(racine) {
  inscrireLaDeclaration({
    nom: 't-20260825-0047',
    role: 'chef-equipe',
    mandat: 'T-20260825-0047',
    coordonnateur: 'e-20260825-0002',
    espace: ESPACE,
    pane: PANE,
    session: nomDeSession(socketDe('somtech')),
    racine,
  });
  const registre = lireLesDeclarations({ racine });
  assert.equal(registre.declarations.length, 1, 'le producteur n’a rien inscrit');
  return registre;
}

/**
 * Le jugement d'UN agent au MÊME pane, dans la MÊME session, dans le MÊME espace que la
 * déclaration — né à l'instant qu'on lui donne.
 *
 * ⚠️ ANONYME, DÉLIBÉRÉMENT : le repli par le nom est borné ailleurs. Sans nom, la SEULE clé
 * qui peut identifier cet agent est « pane-dans-sa-session », celle qu'on éprouve ici.
 */
function jugerUnAgentNeA(registre, instant) {
  const pane = {
    pane_id: PANE,
    agent_session: { agent: 'claude', kind: 'id', source: 'herdr:claude', value: 'sa-session-a-lui' },
    foreground_cwd: ESPACE,
    herdr_socket: socketDe('somtech'),
  };
  return jugerLeParc({
    agents: normaliserLeParc({
      panes: [pane],
      agentsHerdr: [{ pane_id: PANE, herdr_socket: socketDe('somtech'), name: null }],
      naissances: { mesure: 'lue', illisibles: 0, instants: new Map([['sa-session-a-lui', instant]]) },
    }),
    registre,
    portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
  });
}

function bacDeclarations() {
  return mkdtempSync(join(tmpdir(), 'declarations-'));
}

test('🔴 ① LE PANE EST REPRIS DANS LE MÊME ESPACE — la déclaration du prédécesseur ne couvre pas le successeur', () => {
  const racine = bacDeclarations();
  try {
    const registre = leProducteurInscrit(racine);
    // ⚠️ ON NE RECOPIE PAS `ne_le` — on le DEMANDE à celui qui l'a écrit, et on raisonne
    // dessus. Douze heures : le successeur naît bien après tout retard de mesure imaginable.
    const inscrite = Date.parse(registre.declarations[0].ne_le);
    assert.ok(Number.isFinite(inscrite), 'la déclaration doit porter une date lisible');

    const v = jugerUnAgentNeA(registre, inscrite + 12 * 3600 * 1000);

    assert.equal(v.comptes.identifies, 0, `reprendre un pane dans son propre espace n’est pas naître :\n${v.texte}`);
    assert.equal(v.comptes.nonMesures, 1, 'l’incertitude tombe du côté non-vert, sans nommer de fautif');
    assert.equal(v.verdict, VERDICTS.ZONES_NON_MESUREES);
    assert.equal(v.sortie, 2, 'et la sortie doit le dire');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 ① … ET L’AGENT RÉGULIER RESTE IDENTIFIÉ — la déclaration est écrite quelques secondes APRÈS sa naissance', () => {
  const racine = bacDeclarations();
  try {
    const registre = leProducteurInscrit(racine);
    const inscrite = Date.parse(registre.declarations[0].ne_le);

    // Le geste vérifie par le fait, PUIS inscrit : l'agent naît AVANT sa déclaration.
    const v = jugerUnAgentNeA(registre, inscrite - 2_000);

    assert.equal(v.comptes.identifies, 1, `un agent régulier est devenu une prise :\n${v.texte}`);
    assert.equal(v.comptes.parSource[SOURCES.DECLARATION], 1);
    assert.equal(v.verdict, VERDICTS.RIEN_A_SIGNALER);
    assert.equal(v.sortie, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 ① … ET LE RETARD DE LA MESURE EST ABSORBÉ — un transcrit naît après le premier événement de sa session', () => {
  const racine = bacDeclarations();
  try {
    const registre = leProducteurInscrit(racine);
    const inscrite = Date.parse(registre.declarations[0].ne_le);

    // ⚠️ ON NE RECOPIE PAS LA TOLÉRANCE NON PLUS — on la demande au module et on se place
    // DEDANS. Cet essai tient pour n'importe quelle valeur qu'elle prendra.
    const v = jugerUnAgentNeA(registre, inscrite + TOLERANCE_DE_DATATION_MS - 1_000);

    assert.equal(v.comptes.identifies, 1, `le retard ordinaire de la mesure a fait une prise :\n${v.texte}`);
    assert.equal(v.sortie, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

/**
 * L'ÉPINGLE DE LA TOLÉRANCE — contre le MONDE MESURÉ, pas contre une constante recopiée.
 *
 * ⚠️ Une épingle qui compare le module à une valeur que le banc porte lui-même ne garde rien :
 * qui édite les deux ensemble la désarme en silence. Les deux bornes ci-dessous viennent de
 * mesures du poste, et elles encadrent : trop petite, la tolérance refuse les agents réguliers
 * dont le transcrit tarde ; trop grande, elle couvre la journée entière d'un chef d'équipe et
 * rouvre exactement le trou qu'on ferme.
 */
test('🔴 ① LA TOLÉRANCE EST ENCADRÉE PAR CE QUE LE POSTE MONTRE — ni assez petite pour refuser un régulier, ni assez grande pour couvrir un successeur', () => {
  // Mesuré le 2026-08-25 : retard maximum de la mesure sur les 121 transcrits du poste qui
  // datent une vraie conversation — 2 208,8 s. En deçà, la garde refuserait des réguliers.
  assert.ok(
    TOLERANCE_DE_DATATION_MS >= 2_209_000,
    'la tolérance est plus courte que le retard de mesure DÉJÀ observé sur le poste'
  );
  // Un chef d'équipe travaille des heures. Une tolérance qui couvre un quart de journée rend
  // la clé primaire aussi permissive qu'avant pour la reprise du même terminal.
  assert.ok(
    TOLERANCE_DE_DATATION_MS <= 4 * 3600 * 1000,
    'la tolérance couvre le temps de travail d’un chef d’équipe : le successeur hérite à nouveau'
  );
});

/**
 * LA PHRASE IMPRIMÉE DIT-ELLE CE QUE LE CODE FAIT ? — le sens de la règle temporelle.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 ELLE ÉTAIT À L'ENVERS, DANS LES DEUX SENS, SUR CHAQUE RENDU DE LA GARDE.
 *
 * `methode.prises` posait comme condition d'IDENTIFICATION qu'une déclaration soit « INSCRITE
 * AVANT SA NAISSANCE À LUI », et ajoutait qu'« une déclaration plus JEUNE que l'agent qu'elle
 * apparie couvre peut-être son prédécesseur : elle n'identifie pas ». Le code exige l'inverse :
 * `ecart = naissance − inscrite ; if (ecart <= tolerance) → couvre`.
 *
 * MESURÉ :
 *   décl. 13 h · agent né 22 h  (déclaration plus VIEILLE) -> périmée
 *   décl. 22 h · agent né 13 h  (déclaration plus JEUNE)   -> couvre
 *
 * La phrase était fausse deux fois. Une déclaration plus JEUNE que l'agent est le cas NORMAL du
 * régulier — le geste vérifie par le fait, puis inscrit, deux secondes après la naissance — et
 * elle ne peut pas appartenir à son PRÉDÉCESSEUR, qui est par définition antérieur.
 *
 * ⚠️ AUCUNE GARDE NE POUVAIT LE VOIR : les six assertions sur `methode.prises` visent
 * `pane-dans-sa-session`, `par nom`, `ESPACE DE TRAVAIL`, `la SESSION est née après`. Aucune ne
 * touchait la phrase temporelle.
 *
 * ⚠️ CE BANC EST APPARIÉ AU COMPORTEMENT, PAS À UNE TOURNURE. Il MESURE d'abord les deux sens,
 * ce qui épingle la direction dans l'absolu ; il DÉRIVE ensuite de cette mesure le mot que la
 * phrase doit porter. Inverser le code fait rougir les deux premières assertions ; réécrire la
 * phrase à la main fait rougir les suivantes. Et le module ne l'écrit plus à la main non plus :
 * il JOUE sa propre règle pour savoir quel sens elle refuse (`sensQueLaRegleTemporelleRefuse`).
 */
test('🔴 LE SENS DE LA RÈGLE TEMPORELLE — mesuré, puis exigé de la phrase que chaque rendu imprime', () => {
  const t = (h) => Date.parse(`2026-08-25T${h}:00:00.000Z`);
  const plusVieille = couvertureDeLaDeclaration({ ne_le: new Date(t('13')).toISOString() }, t('22'));
  const plusJeune = couvertureDeLaDeclaration({ ne_le: new Date(t('22')).toISOString() }, t('13'));

  // ── LA DIRECTION, ÉPINGLÉE DANS L'ABSOLU. C'est elle qui empêche ce banc de suivre une
  // inversion du code : sans ces deux lignes, le mot dérivé plus bas basculerait avec lui.
  assert.equal(
    plusVieille.etat,
    'périmée',
    'une déclaration inscrite AVANT la naissance, au-delà de la tolérance, n’identifie PAS'
  );
  assert.equal(
    plusJeune.etat,
    'couvre',
    'une déclaration inscrite APRÈS la naissance identifie — c’est le cas NORMAL du régulier'
  );

  // ── LE MOT QUE LA PHRASE DOIT PORTER, DÉRIVÉ DE LA MESURE CI-DESSUS.
  const refuse = plusVieille.etat === 'couvre' ? 'APRÈS' : 'AVANT';
  const accepte = refuse === 'AVANT' ? 'APRÈS' : 'AVANT';

  const methode = jugerLeParc({ agents: [], registre: { declarations: [], illisibles: [] } }).methode.prises;

  assert.match(
    methode,
    new RegExp(`INSCRITE ${accepte} SA NAISSANCE`),
    `la phrase imprimée doit poser « inscrite ${accepte} sa naissance » comme ce qui IDENTIFIE`
  );
  assert.doesNotMatch(
    methode,
    new RegExp(`INSCRITE ${refuse} SA NAISSANCE`),
    `elle pose « inscrite ${refuse} sa naissance » comme condition d’identification — le code refuse ce sens-là`
  );
  assert.doesNotMatch(
    methode,
    /plus JEUNE/,
    'et elle ne peut plus dire qu’une déclaration plus JEUNE n’identifie pas : c’est le cas normal du régulier'
  );
});

/**
 * LA COUVERTURE A TROIS ÉTATS, ET LE TROISIÈME N'EST PAS UN VIDE.
 *
 * Une déclaration dont la date est illisible ne prouve NI qu'elle couvre cet agent, NI qu'elle
 * ne le couvre pas. La replier sur l'un des deux est le motif « ce qu'on n'a pas mesuré tombe
 * du côté commode » — ici, les deux côtés commodes existent.
 */
test('🔴 ① UNE DÉCLARATION SANS DATE LISIBLE NE COUVRE RIEN — et ne condamne rien non plus', () => {
  const couvre = couvertureDeLaDeclaration({ ne_le: new Date().toISOString() }, Date.now());
  assert.equal(couvre.etat, 'couvre');

  for (const ne_le of [undefined, null, '', 'hier', '20260825-101721']) {
    const v = couvertureDeLaDeclaration({ ne_le }, Date.now());
    assert.equal(v.etat, 'indécidable', `« ${ne_le} » n’est pas une date, et ça doit se dire`);
    assert.ok(v.raison, 'un refus sans raison n’envoie personne nulle part');
  }

  const sansNaissance = couvertureDeLaDeclaration({ ne_le: new Date().toISOString() }, null);
  assert.equal(sansNaissance.etat, 'indécidable');
});

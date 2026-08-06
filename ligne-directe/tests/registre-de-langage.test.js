// Le registre de langage — le veilleur écrit EN NOTRE NOM, et pas toujours au dirigeant.
//
// Deux choses se jouent ici, et la seconde est la plus grave :
//
//   1. ce que le veilleur répond DANS SLACK quand personne n'est au bout du fil. Écrit pour
//      le dirigeant, ce langage nomme nos rouages (« son pane a disparu ») et recopie nos
//      messages d'erreur. Adressé à un client, il expose notre outillage et sonne comme une
//      panne interne ;
//
//   2. ce que le cadre annonce DANS LE PANE. Il dit aujourd'hui « Message du dirigeant »,
//      sans condition. Sur une ligne cliente, il donnerait à la phrase d'un client
//      l'autorité d'une consigne du dirigeant — et l'agent la traiterait comme telle. Un
//      client demande ; il n'ordonne pas.
//
// LES ASSERTIONS SONT ÉCRITES EN NÉGATIF, délibérément. Vérifier qu'un mot attendu est
// présent ne prouve rien ici : ce qui coûte cher, c'est le mot qui ne devrait PAS être là —
// le repli silencieux sur « dirigeant », le terme d'outillage qui part vers un tiers. Et le
// balayage porte sur L'ENSEMBLE des réponses, jamais sur trois cas choisis : la quatrième
// réponse est justement celle qu'on oubliera.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let Veilleur, sauverRegistre, cadrerPourAgent, COMMANDE, CAUSES, reponse;
let racine;

const ICI = dirname(fileURLToPath(import.meta.url));

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-langage-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre } = await import('../src/registre.js'));
  ({ cadrerPourAgent, COMMANDE } = await import('../src/cadre.js'));
  ({ CAUSES, reponse } = await import('../src/langage.js'));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [] }));

/**
 * Le vocabulaire qui n'a rien à faire sous les yeux d'un tiers.
 *
 * Ce ne sont pas des mots « moches » : chacun nomme une pièce de notre outillage ou un
 * chantier interne. Les voir, c'est comprendre comment on travaille — et croire à une panne
 * chez nous quand il ne se passe rien.
 */
const OUTILLAGE = ['pane', 'veilleur', 'ligne close', 'worktree', 'herdr', 'chantier', 'agent', 'registre', 'socket'];

/** Marqueurs injectés dans les détails : s'ils ressortent côté client, la fuite est prouvée. */
const CODE_CHANTIER = 'D-20260805-0005';
const ERREUR_TECHNIQUE = 'herdr: pane w26:pQ introuvable (socket absent)';

const DETAILS = {
  canal: 'client-acme',
  chantier: CODE_CHANTIER,
  pane: 'w26:pQ',
  close_le: '2026-08-06T10:00:00.000Z',
  erreur: ERREUR_TECHNIQUE,
};

function slackDouble({ nom = 'Jean Tremblay', nomIllisible = false } = {}) {
  return {
    postes: [],
    nomsDemandes: [],
    async poster(_j, m) {
      this.postes.push(m);
      return '1';
    },
    async nomDeMembre(_j, utilisateur) {
      this.nomsDemandes.push(utilisateur);
      if (nomIllisible) throw new Error('missing_scope');
      return nom;
    },
    async membresDuCanal() {
      return ['UCLIENT'];
    },
    async creerCanal(_j, n, prive) {
      return { id: `C_${n}`, nom: n, prive: Boolean(prive), reutilise: false };
    },
    async definirSujet() {},
    async inviter() {},
    async archiverCanal() {
      return true;
    },
  };
}

function herdrDouble({ vivant = true, echecRemise = null, echecVivant = null } = {}) {
  return {
    remis: [],
    async vivant() {
      if (echecVivant) throw new Error(echecVivant);
      return vivant;
    },
    async remettre(pane, texte) {
      if (echecRemise) throw new Error(echecRemise);
      this.remis.push({ pane, texte });
      return {};
    },
    async agents() {
      return [{ agent: 'claude', pane_id: 'w1:p1' }];
    },
  };
}

let compteur = 0;
const veilleur = (opts = {}) =>
  new Veilleur({
    cheminSocket: join(racine, `${(compteur += 1)}.sock`),
    jetons: { robot: 'x', ecoute: 'y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    ...opts,
  });

const ligne = (sur = {}) => ({
  chantier: CODE_CHANTIER,
  canal_id: 'C1',
  canal_nom: 'd-20260805-0005',
  pane: 'w1:p1',
  worktree: '/w/a',
  visage: '🧭',
  ouverte_le: 'hier',
  close_le: null,
  herdr_socket: null,
  autorises: ['UDIR'],
  ...sur,
});

const parole = (texte, sur = {}) => ({ type: 'message', channel: 'C1', user: 'UDIR', text: texte, ...sur });

/** Aucun terme d'outillage, aucune fuite de code de chantier ni de message d'erreur. */
function estPresentable(texte, ou) {
  for (const mot of OUTILLAGE) {
    assert.ok(!texte.toLowerCase().includes(mot), `${ou} : « ${mot} » ne doit pas atteindre un client — reçu : ${texte}`);
  }
  assert.ok(!texte.includes(CODE_CHANTIER), `${ou} : le code du chantier ne part pas chez un client — reçu : ${texte}`);
  assert.ok(!texte.includes(ERREUR_TECHNIQUE), `${ou} : le message d'erreur ne part pas chez un client — reçu : ${texte}`);
}

// ═══════════════════════════ T-20260806-0100 — le cadre nomme l'auteur réel (EF-REL-008)

test('NON-RÉGRESSION — le cadre interne est identique MOT POUR MOT à ce que le dirigeant lit aujourd’hui', () => {
  // Quatre lignes internes tournent en production pendant ce travail. Le texte attendu est
  // recopié du livré, pas reconstruit depuis le code : une approximation ferait passer pour
  // « inchangé » un cadre qui aurait glissé.
  const attendu = [
    `[LIGNE DIRECTE — D-1 (#d-1)] Message du dirigeant, reçu par Slack :`,
    '',
    'on continue',
    '',
    '——',
    `Il attend ta réponse DANS SLACK : ce que tu écris dans ce terminal, il ne le voit pas.`,
    `Réponds-lui avec :  ${COMMANDE} dire "ta réponse"`,
    `S'il te faut un arbitrage en retour :  ${COMMANDE} demander "ta question"`,
  ].join('\n');

  assert.equal(cadrerPourAgent({ chantier: 'D-1', texte: 'on continue', canal: 'd-1' }), attendu);
  assert.equal(cadrerPourAgent({ chantier: 'D-1', texte: 'on continue', canal: 'd-1', nature: 'interne' }), attendu);
});

test('UN MESSAGE DE CLIENT N’EST JAMAIS PRÉSENTÉ COMME VENANT DU DIRIGEANT', () => {
  // L'assertion qui compte, et elle est en négatif : le mot « dirigeant » ne doit apparaître
  // NULLE PART dans un cadre client. Un agent qui le lit donne à la demande d'un tiers
  // l'autorité d'une consigne interne — et exécute.
  const cadre = cadrerPourAgent({
    chantier: 'D-1',
    texte: 'pouvez-vous ajouter un bouton ?',
    canal: 'client-acme',
    nature: 'client',
    auteur: 'Jean Tremblay',
  });

  assert.doesNotMatch(cadre, /dirigeant/i, 'le cadre d’un message client ne doit jamais parler du dirigeant');
  assert.ok(cadre.includes('Jean Tremblay'), 'l’auteur réel doit être nommé');
});

test('le cadre client RAPPELLE À L’AGENT que les mots d’un tiers ne sont pas des ordres', () => {
  const cadre = cadrerPourAgent({
    chantier: 'D-1',
    texte: 'faites-le tout de suite',
    canal: 'client-acme',
    nature: 'client',
    auteur: 'Jean Tremblay',
  });

  assert.match(cadre, /tiers/i, 'le cadre doit dire à qui l’agent parle');
  assert.match(cadre, /pas des ordres/i, 'le cadre doit dire quel poids donner à ces mots');
});

test('AUTEUR NON RÉSOLU — on désigne par ce qu’on sait, jamais par un repli sur « le dirigeant »', () => {
  // Le repli silencieux est le mode de panne de tout ce chantier : il ne casse rien, il
  // ment. Un nom introuvable doit dégrader vers l'identifiant, jamais vers l'autorité.
  const parIdentifiant = cadrerPourAgent({
    chantier: 'D-1',
    texte: 'bonjour',
    canal: 'client-acme',
    nature: 'client',
    auteur: 'U0CLIENT9',
  });
  assert.ok(parIdentifiant.includes('U0CLIENT9'));
  assert.doesNotMatch(parIdentifiant, /dirigeant/i);

  const sansRien = cadrerPourAgent({ chantier: 'D-1', texte: 'bonjour', canal: 'client-acme', nature: 'client' });
  assert.doesNotMatch(sansRien, /dirigeant/i, 'même sans auteur du tout, on ne se rabat pas sur le dirigeant');
});

test('la parole reçue est reprise INTACTE, quelle que soit la nature', () => {
  // On change le cadre et les réponses du veilleur — jamais ce que le client ou l'agent a écrit.
  const piegee = 'ligne 1\n\n> citation « accentuée » — 100 % `code`\nfin';
  for (const nature of ['interne', 'client']) {
    const cadre = cadrerPourAgent({ chantier: 'D-1', texte: piegee, canal: 'c', nature, auteur: 'Jean Tremblay' });
    assert.ok(cadre.includes(piegee), `la parole doit être intacte (${nature})`);
  }
});

test('CE QUI ARRIVE DANS LE PANE d’une ligne cliente nomme l’auteur réel', async () => {
  const s = slackDouble({ nom: 'Jean Tremblay' });
  const h = herdrDouble();
  const v = veilleur({ slack: s, herdr: h });
  v.registre.lignes.push(ligne({ nature: 'client', autorises: ['UCLIENT'] }));

  await v.remettreAuChantier(parole('pouvez-vous ajouter un bouton ?', { user: 'UCLIENT' }));

  assert.equal(h.remis.length, 1, 'le message doit atteindre le pane');
  assert.ok(h.remis[0].texte.includes('Jean Tremblay'));
  assert.doesNotMatch(h.remis[0].texte, /dirigeant/i);
});

test('NON-RÉGRESSION — sur une ligne interne, le pane reçoit exactement le cadre d’aujourd’hui, sans un appel de plus', async () => {
  // Le second point est aussi important que le premier : interroger l'annuaire à chaque
  // message du dirigeant ajouterait un appel plafonné sur le chemin le plus fréquent.
  const s = slackDouble();
  const h = herdrDouble();
  const v = veilleur({ slack: s, herdr: h });
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole('on continue'));

  assert.equal(
    h.remis[0].texte,
    cadrerPourAgent({ chantier: CODE_CHANTIER, texte: 'on continue', canal: 'd-20260805-0005' })
  );
  assert.deepEqual(s.nomsDemandes, [], 'aucun appel Slack pour nommer l’auteur sur une ligne interne');
});

test('un nom d’auteur illisible N’EMPÊCHE PAS le message d’arriver, et ne le fait pas passer pour le dirigeant', async () => {
  // L'accessoire ne conditionne jamais l'arrivée du principal : perdre le message d'un
  // client parce qu'un droit d'annuaire manque serait une conversation manquée.
  const s = slackDouble({ nomIllisible: true });
  const h = herdrDouble();
  const v = veilleur({ slack: s, herdr: h });
  v.registre.lignes.push(ligne({ nature: 'client', autorises: ['UCLIENT'] }));

  await v.remettreAuChantier(parole('bonjour', { user: 'UCLIENT' }));

  assert.equal(h.remis.length, 1, 'le message doit arriver malgré tout');
  assert.ok(h.remis[0].texte.includes('UCLIENT'), 'à défaut de nom, l’identifiant désigne l’auteur');
  assert.doesNotMatch(h.remis[0].texte, /dirigeant/i);
});

// ═══════════════ T-20260806-0101 — chaque réponse a sa variante cliente (EF-REL-008)

test('BALAYAGE — CHAQUE réponse automatique a sa variante cliente, et AUCUNE n’expose notre outillage', () => {
  // On parcourt l'ENSEMBLE des causes, pas un échantillon. Une septième cause ajoutée
  // demain sans sa variante cliente fait rougir ici, au lieu de partir telle quelle.
  assert.ok(CAUSES.length >= 6, 'les six situations de non-remise connues doivent être déclarées');

  for (const cause of CAUSES) {
    const interne = reponse(cause, 'interne', DETAILS);
    const client = reponse(cause, 'client', DETAILS);

    assert.equal(typeof client, 'string');
    assert.ok(client.trim().length > 0, `${cause} : la variante cliente ne peut pas être vide`);
    assert.notEqual(client, interne, `${cause} : la variante cliente ne peut pas être le texte interne`);
    estPresentable(client, `réponse « ${cause} »`);
  }
});

test('NON-RÉGRESSION — les réponses internes sont identiques MOT POUR MOT au livré', () => {
  // Recopiées du code livré, pas reconstruites : c'est ce que le dirigeant lit aujourd'hui.
  const attendu = {
    non_autorise: "Ton message n'a été remis à aucun agent : tu n'es pas autorisé à écrire sur cette ligne.",
    ligne_inconnue:
      "Un message est arrivé sur #client-acme, qui ne correspond à AUCUNE ligne du registre — il n'a été remis à aucun agent. Le canal étant privé, son auteur a reçu une réponse cliente.",
    message_vide: "Ton message est arrivé sans rien à remettre — ni texte, ni pièce jointe. Il n'a donc été remis à aucun agent.",
    ligne_close: `Cette ligne est close depuis le 2026-08-06 — plus personne ne travaille sur ${CODE_CHANTIER}. Ton message n'a donc été remis à aucun agent.`,
    agent_injoignable: `Je n'arrive pas à joindre l'agent de ${CODE_CHANTIER} en ce moment (${ERREUR_TECHNIQUE}). Ton message n'a été remis à personne — renvoie-le dans un instant.`,
    agent_disparu: `L'agent de ${CODE_CHANTIER} n'est plus là — son pane w26:pQ a disparu. Je referme la ligne ; ton message n'a été remis à personne.`,
    echec_remise: `Je n'ai pas pu remettre ton message à l'agent de ${CODE_CHANTIER} : ${ERREUR_TECHNIQUE}`,
    reprise_agent_disparu: `Je reprends du service et l'agent de ${CODE_CHANTIER} n'est plus là. Je referme cette ligne.`,
    piece_trop_lourde:
      "Le message est bien remis, mais une pièce jointe dépasse 5 Mo : elle n'a pas été recueillie. Le registre des demandes la refuserait de toute façon.",
    piece_type_refuse:
      "Le message est bien remis, mais une pièce jointe n'est pas d'un type recevable (jpeg, png, gif, webp, pdf, markdown) : elle n'a pas été recueillie.",
    piece_non_recuperee: `Le message est bien remis, mais je n'ai pas pu récupérer une pièce jointe : ${ERREUR_TECHNIQUE}.`,
  };

  for (const [cause, texte] of Object.entries(attendu)) {
    assert.equal(reponse(cause, 'interne', DETAILS), texte, `${cause} : le registre interne a bougé`);
  }
  assert.deepEqual([...CAUSES].sort(), Object.keys(attendu).sort(), 'toute cause déclarée doit avoir sa preuve de non-régression');
});

test('une cause ou une nature inconnue ÉCHOUE — jamais de repli silencieux sur un texte quelconque', () => {
  assert.throws(() => reponse('cause_qui_nexiste_pas', 'client', DETAILS), /cause/i);
  assert.throws(() => reponse('non_autorise', 'natures_inventee', DETAILS), /nature/i);
});

test('STRUCTUREL — le veilleur ne peut PAS écrire un texte en clair dans un canal', () => {
  // La garantie qui tient dans le temps. Le balayage ci-dessus ne couvre que ce qui passe
  // par le registre ; un point d'appel qui passerait sa propre phrase le contournerait
  // entièrement, et c'est exactement ainsi qu'une phrase interne finit chez un client.
  const source = readFileSync(join(ICI, '..', 'src', 'veilleur.js'), 'utf8');
  // `this.` cible les APPELS et rien d'autre — la définition de la méthode n'en est pas un.
  const appels = [...source.matchAll(/this\.repondreEnPropre\(\s*([^;]*?)\)\s*;/gs)];

  assert.ok(appels.length >= 6, 'les six chemins de non-remise doivent être présents');

  const causesUtilisees = new Set();
  for (const appel of appels) {
    const args = appel[1];
    const cause = args.match(/,\s*'([a-z_]+)'/);
    assert.ok(cause, `un texte en clair passe dans un canal : ${appel[0].slice(0, 120)}`);
    assert.ok(CAUSES.includes(cause[1]), `cause inconnue au registre de langage : ${cause[1]}`);
    assert.ok(!/["`]/.test(args), `aucune phrase ne se rédige au point d’appel : ${appel[0].slice(0, 120)}`);
    causesUtilisees.add(cause[1]);
  }
  assert.deepEqual([...causesUtilisees].sort(), [...CAUSES].sort(), 'toute cause déclarée doit être réellement utilisée');
});

/** Les seules méthodes du veilleur qui aient le droit d'écrire dans un canal Slack. */
const SITES_SANCTIONNES = ['dire', 'fermer', 'repondreEnPropre'];

/**
 * Dans quelle méthode de la classe tombe ce point de la source ?
 *
 * On repère les entêtes de méthode à leur indentation de deux espaces — celle des membres
 * de classe. Les fonctions du module ne sont pas indentées, les fermetures internes le sont
 * davantage : ni les unes ni les autres ne se font passer pour une méthode.
 */
function methodeContenant(source, position) {
  let methode = null;
  for (const entete of source.matchAll(/^ {2}(?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)) {
    if (entete.index > position) break;
    methode = entete[1];
  }
  return methode;
}

test('STRUCTUREL — AUCUN autre chemin du veilleur ne peut écrire dans un canal', () => {
  // RELEVÉ EN REVUE, et c'était un bloquant : la garde ci-dessus n'inspecte QUE les appels à
  // `repondreEnPropre`. Elle vérifiait la porte principale pendant que le mur restait ouvert
  // à côté — un septième chemin de non-remise appelant `this.slack.poster` directement, avec
  // le nom du pane et le code du chantier dans sa phrase, partait chez un client sans qu'un
  // seul test rougisse. Mesuré par le reviewer : 131 verts, zéro échec.
  //
  // La garde porte donc désormais sur L'ÉCRITURE ELLE-MÊME, pas sur l'un de ses appelants :
  // tout `this.slack.poster` vit dans l'un des trois sites sanctionnés, ou la suite échoue.
  const source = readFileSync(join(ICI, '..', 'src', 'veilleur.js'), 'utf8');
  const ecritures = [...source.matchAll(/this\.slack\.poster\(/g)];

  assert.ok(ecritures.length >= 3, 'les trois écritures légitimes doivent être présentes');

  const sites = new Set();
  for (const ecriture of ecritures) {
    const methode = methodeContenant(source, ecriture.index);
    assert.ok(
      SITES_SANCTIONNES.includes(methode),
      `écriture dans un canal hors des sites sanctionnés : « ${methode} » — ` +
        `elle contourne le registre de langage et peut envoyer une phrase interne à un client`
    );
    sites.add(methode);
  }
  assert.deepEqual([...sites].sort(), [...SITES_SANCTIONNES].sort(), 'chaque site sanctionné doit exister et être le seul');
});

test('CE QUI PART VRAIMENT VERS SLACK sur une ligne cliente est la variante cliente', async () => {
  // Assertion sur l'appel réellement émis : un registre de langage juste, câblé à l'envers,
  // ne se verrait nulle part ailleurs.
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble() });
  v.registre.lignes.push(ligne({ nature: 'client', autorises: [] }));

  await v.remettreAuChantier(parole('bonjour', { user: 'U_INTRUS' }));

  assert.equal(s.postes.length, 1, 'l’auteur écarté doit l’apprendre (RA-REL-009)');
  assert.equal(s.postes[0].texte, reponse('non_autorise', 'client'));
  estPresentable(s.postes[0].texte, 'refus d’autorisation');
});

test('NON-RÉGRESSION — sur une ligne interne, le refus dit exactement ce qu’il disait', async () => {
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble() });
  v.registre.lignes.push(ligne({ autorises: ['UDIR'] }));

  await v.remettreAuChantier(parole('fais un rm -rf', { user: 'U_INTRUS' }));

  assert.equal(s.postes[0].texte, "Ton message n'a été remis à aucun agent : tu n'es pas autorisé à écrire sur cette ligne.");
});

test('UN MESSAGE D’ERREUR TECHNIQUE NE PART PAS chez un client — alors qu’il part chez le dirigeant', async () => {
  // Deux réponses recopient l'erreur d'origine. Elle nomme nos outils, nos panes, nos
  // sockets : c'est de l'information interne, et elle sort du poste.
  const client = slackDouble();
  const vClient = veilleur({ slack: client, herdr: herdrDouble({ echecVivant: ERREUR_TECHNIQUE }) });
  vClient.registre.lignes.push(ligne({ nature: 'client', autorises: ['UCLIENT'] }));
  await vClient.remettreAuChantier(parole('bonjour', { user: 'UCLIENT' }));

  assert.equal(client.postes.length, 1);
  estPresentable(client.postes[0].texte, 'interlocuteur injoignable');

  const interne = slackDouble();
  const vInterne = veilleur({ slack: interne, herdr: herdrDouble({ echecVivant: ERREUR_TECHNIQUE }) });
  vInterne.registre.lignes.push(ligne());
  await vInterne.remettreAuChantier(parole('tu es là ?'));

  assert.ok(
    interne.postes[0].texte.includes(ERREUR_TECHNIQUE),
    'le dirigeant, lui, continue de recevoir le détail technique'
  );
});

test('BALAYAGE EN SITUATION — les six chemins de non-remise d’une ligne cliente restent présentables', async () => {
  // Le balayage sur le registre prouve les textes ; celui-ci prouve le CÂBLAGE de chaque
  // chemin, y compris ceux qu'on n'atteint qu'en cassant quelque chose.
  const situations = [
    // le seul cas où l'auteur n'est PAS membre du canal privé : c'est ce qui l'écarte
    ['message écarté', { ligne: { nature: 'client', autorises: [] }, herdr: {}, user: 'U_INTRUS' }],
    ['conversation terminée', { ligne: { nature: 'client', autorises: ['UCLIENT'], close_le: '2026-08-06T10:00:00.000Z' }, herdr: {} }],
    ['interlocuteur injoignable', { ligne: { nature: 'client', autorises: ['UCLIENT'] }, herdr: { echecVivant: ERREUR_TECHNIQUE } }],
    ['interlocuteur disparu', { ligne: { nature: 'client', autorises: ['UCLIENT'] }, herdr: { vivant: false } }],
    ['échec de remise', { ligne: { nature: 'client', autorises: ['UCLIENT'] }, herdr: { echecRemise: ERREUR_TECHNIQUE } }],
  ];

  for (const [quoi, { ligne: sur, herdr: opts, user = 'UCLIENT' }] of situations) {
    sauverRegistre({ version: 1, lignes: [] });
    const s = slackDouble();
    const v = veilleur({ slack: s, herdr: herdrDouble(opts) });
    v.registre.lignes.push(ligne(sur));

    await v.remettreAuChantier(parole('bonjour', { user }));

    assert.equal(s.postes.length, 1, `${quoi} : le client doit recevoir une réponse`);
    estPresentable(s.postes[0].texte, quoi);
  }

  // Sixième chemin : la reprise du service, qui referme les lignes dont l'agent a disparu.
  //
  // CE CAS A ÉTÉ RENVERSÉ, et le renversement vaut d'être expliqué là où le test l'attend.
  // Ce fichier affirmait « le client doit l'apprendre ». Il ne le doit pas : la mort de
  // notre session est un événement interne, la sienne continue, et son canal n'est plus
  // archivé — la conversation reprendra dès qu'une session neuve s'y rattache. L'informer,
  // c'était lui exposer notre plomberie pour un incident qu'on répare, et l'inviter à
  // repartir par courriel. Le silence s'arrête quand IL écrit : les cinq situations
  // ci-dessus couvrent ce moment-là, y compris « interlocuteur disparu ».
  sauverRegistre({ version: 1, lignes: [] });
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble() });
  v.registre.lignes.push(ligne({ nature: 'client', pane: 'w9:pDISPARU' }));
  await v.reconcilier();

  assert.deepEqual(s.postes, [], 'reprise du service : sur une ligne cliente, on ne dit rien');
});

// Ce que le client dépose — et ce qui arrive quand ça ne passe pas.
//
// Un client qui signale un problème envoie une capture d'écran AVANT d'écrire trois phrases.
// C'est le cas nominal, pas un confort. Et les adresses de fichiers Slack sont privées : il
// faut présenter le jeton pour les obtenir.
//
// CES TESTS TOURNENT CONTRE LE VRAI CODE DE TÉLÉCHARGEMENT, pas contre un double du veilleur :
// le double de Slack sert les fichiers comme Slack les sert — il exige le jeton porteur, et
// SANS le droit `files:read` il rend une page de connexion en HTML avec un code 200, exactement
// comme le vrai. C'est la leçon la plus chère du chantier : un double plus permissif que le
// service qu'il imite a déjà couvert une capacité entièrement inerte derrière 97 tests verts.
//
// Ce qui compte ici, ce sont les cas d'échec — pas le chemin nominal :
//   - une image ne bloque JAMAIS le message (RA-REL-010) ;
//   - la limite de 5 Mo produit une phrase présentable au client, jamais un échec silencieux ;
//   - le jeton ne fuit nulle part : ni chemin, ni trace, ni message d'erreur ;
//   - une capture contient souvent des données personnelles : dépôt en droits restreints,
//     et rien du contenu au journal.

import { test, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';

let Veilleur, sauverRegistre, CHEMIN_JOURNAL, telechargerFichier, RACINE_PIECES, TAILLE_MAX;
let racine;

/** Le jeton du robot — s'il ressort où que ce soit, la fuite est prouvée. */
const JETON = 'xoxb-JETON-QUI-NE-DOIT-JAMAIS-SORTIR';

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-pieces-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, CHEMIN_JOURNAL } = await import('../src/registre.js'));
  ({ telechargerFichier } = await import('../src/slack.js'));
  ({ RACINE_PIECES, TAILLE_MAX } = await import('../src/pieces.js'));
});

let monde;
beforeEach(() => {
  sauverRegistre({ version: 1, lignes: [] });
  writeFileSync(CHEMIN_JOURNAL, '');
  // Le dépôt SURVIT d'un test à l'autre — c'est sa raison d'être. Un test qui compte les
  // pièces déposées compterait donc celles du précédent, et « rien ne se dépose » serait faux
  // pour une raison qui n'a rien à voir avec ce qu'il prouve.
  rmSync(RACINE_PIECES, { recursive: true, force: true });
  monde = null;
});
afterEach(() => monde?.restaurer());

const journal = () => (existsSync(CHEMIN_JOURNAL) ? readFileSync(CHEMIN_JOURNAL, 'utf8') : '');

const ADRESSE = 'https://files.slack.invalide/files-pri/T1-F1/download/capture.png';
const PIXELS = Buffer.from('\x89PNG des pixels bien à moi');

/** Ce que Slack envoie dans l'événement quand quelqu'un dépose un fichier. */
const capture = (sur = {}) => ({
  id: 'F1',
  name: 'capture.png',
  mimetype: 'image/png',
  filetype: 'png',
  size: PIXELS.length,
  url_private_download: ADRESSE,
  ...sur,
});

function espace({ fichiers = { [ADRESSE]: { octets: PIXELS, mime: 'image/png' } }, droitFichiers = true } = {}) {
  monde = fauxSlack({
    canaux: [{ id: 'C1', name: 'client-acme', is_private: true, membres: ['UMOI', 'UCLIENT'] }],
    utilisateurs: [{ id: 'UCLIENT', name: 'jean', real_name: 'Jean Tremblay', profile: {} }],
    fichiers,
    droitFichiers,
  });
  return monde.installer();
}

function herdrDouble() {
  return {
    remis: [],
    async vivant() {
      return true;
    },
    async remettre(pane, texte) {
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
    jetons: { robot: JETON, ecoute: 'y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    herdr: herdrDouble(),
    ...opts,
  });

const ligne = (sur = {}) => ({
  chantier: 'D-20260805-0005',
  canal_id: 'C1',
  canal_nom: 'client-acme',
  pane: 'w1:p1',
  worktree: '/w/a',
  visage: '🧭',
  ouverte_le: 'hier',
  close_le: null,
  herdr_socket: null,
  nature: 'client',
  libelle: 'Espace Acme',
  autorises: ['UCLIENT'],
  noms: { UCLIENT: 'Jean Tremblay' },
  ...sur,
});

const parole = (sur = {}) => ({
  type: 'message',
  subtype: 'file_share',
  channel: 'C1',
  user: 'UCLIENT',
  text: 'voilà ce que je vois',
  files: [capture()],
  ...sur,
});

const telechargements = () => monde.appels.filter((a) => a.methode === 'files.download');

/** Le chemin de la seule pièce déposée pour ce canal, ou null. */
function deposees(canal = 'C1') {
  const dossier = join(RACINE_PIECES, canal);
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier).map((n) => join(dossier, n));
}

// ═════════════════════════ T-20260806-0133 — la capture arrive chez son interlocuteur

test('LA CAPTURE EST RÉCUPÉRÉE EN PRÉSENTANT LE JETON, et l’agent sait où la lire', async () => {
  const m = espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole());

  // 1. le jeton a bien été présenté — le double refuse tout ce qui n'en porte pas
  assert.equal(telechargements().length, 1, 'la pièce doit être demandée à Slack');
  assert.equal(telechargements()[0].autorise, `Bearer ${JETON}`, 'les adresses de fichiers Slack sont privées');

  // 2. la pièce est sur le poste, octet pour octet
  const fichiers = deposees();
  assert.equal(fichiers.length, 1, 'la pièce doit être déposée là où l’agent peut la lire');
  assert.deepEqual(readFileSync(fichiers[0]), PIXELS, 'le contenu déposé doit être celui reçu');

  // 3. l'agent SAIT qu'elle est là, et où
  assert.equal(m.postes.length, 0, 'le chemin nominal ne dit rien au client');
  const cadre = v.herdr.remis[0].texte;
  assert.ok(cadre.includes('voilà ce que je vois'), 'le texte du client arrive intact');
  assert.ok(cadre.includes('capture.png'), 'le cadre nomme la pièce');
  assert.ok(cadre.includes(fichiers[0]), 'le cadre donne le chemin exact de lecture');
});

test('LE DÉPÔT LOCAL EST EN DROITS RESTREINTS — une capture porte souvent des données personnelles', async () => {
  espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole());

  const fichier = deposees()[0];
  assert.equal(statSync(join(RACINE_PIECES, 'C1')).mode & 0o777, 0o700, 'le dossier n’est lisible que par ce compte');
  assert.equal(statSync(fichier).mode & 0o777, 0o600, 'le fichier n’est lisible que par ce compte');
});

test('LE JETON NE FUIT NULLE PART — ni chemin, ni trace, ni cadre, ni message au client, ni erreur', async () => {
  // Balayage en négatif sur TOUT ce qui sort du veilleur, la pièce réussie ET la pièce ratée
  // dans le même message : c'est le chemin d'erreur qui recopie le plus volontiers ce qu'il
  // ne devrait pas.
  const m = espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(
    parole({
      files: [capture(), capture({ id: 'F2', name: 'perdue.png', url_private_download: 'https://files.slack.invalide/absente' })],
    })
  );

  const sorties = [
    ...deposees(),
    journal(),
    v.herdr.remis.map((r) => r.texte).join('\n'),
    m.postes.map((p) => `${p.text} ${p.username}`).join('\n'),
  ];

  let erreurLevee = '';
  try {
    await telechargerFichier(JETON, { id: 'FX', url_private_download: 'https://files.slack.invalide/absente' });
  } catch (err) {
    erreurLevee = `${err.message} ${JSON.stringify(err.details ?? '')}`;
  }
  assert.ok(erreurLevee, 'une récupération impossible doit lever, pas rendre un objet vide');
  sorties.push(erreurLevee);

  for (const sortie of sorties) {
    assert.ok(!sortie.includes(JETON), `le jeton ne doit apparaître nulle part — trouvé dans : ${sortie.slice(0, 200)}`);
    assert.ok(!sortie.includes('xoxb'), `aucun fragment de jeton ne doit sortir — trouvé dans : ${sortie.slice(0, 200)}`);
  }
});

test('RIEN DU CONTENU N’EST JOURNALISÉ — on trace le fait, jamais ce que la capture montre', async () => {
  espace({ fichiers: { [ADRESSE]: { octets: Buffer.from('numero-assurance-sociale-123456789'), mime: 'image/png' } } });
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole({ files: [capture({ name: 'jean-tremblay-dossier-medical.png' })] }));

  const trace = journal();
  assert.match(trace, /pièce/i, 'le journal doit dire qu’une pièce est arrivée');
  assert.ok(!trace.includes('numero-assurance-sociale'), 'le contenu de la pièce ne va pas au journal');
  assert.ok(!trace.includes('jean-tremblay-dossier-medical'), 'le nom d’une pièce en dit déjà trop — il n’y va pas non plus');
});

test('UN NOM DE FICHIER PIÉGÉ ne fait pas sortir la pièce de son dépôt', async () => {
  // Le nom vient du client. Il désigne un fichier qu'on écrit sur notre poste.
  espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole({ files: [capture({ name: '../../../../evasion.png' })] }));

  const fichiers = deposees();
  assert.equal(fichiers.length, 1, 'la pièce doit être déposée');
  assert.ok(fichiers[0].startsWith(join(RACINE_PIECES, 'C1')), `la pièce est sortie de son dépôt : ${fichiers[0]}`);
  assert.ok(!existsSync(join(racine, 'evasion.png')), 'rien ne doit être écrit hors du dépôt');
});

test('SANS LE DROIT DE LECTURE DES FICHIERS, Slack rend une page de connexion avec un code 200', async () => {
  // LE PIÈGE, et il ne se signale pas : sans `files:read`, Slack ne refuse pas — il répond
  // 200 avec du HTML. Un code qui se contente du code de réponse déposerait une page web sur
  // le poste, l'appellerait « capture.png », et l'agent ouvrirait une page de connexion.
  const m = espace({ droitFichiers: false });
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole());

  assert.equal(deposees().length, 0, 'une page de connexion n’est pas une pièce : rien ne se dépose');
  assert.equal(v.herdr.remis.length, 1, 'le message du client arrive quand même');
  assert.equal(m.postes.length, 1, 'et le client apprend que sa pièce n’est pas passée');
  assert.match(journal(), /droit/i, 'le journal dit la cause plutôt que de la faire deviner');
});

test('LA CLOISON D’ESSAIS retient aussi le téléchargement d’une pièce', async () => {
  // Sans double monté, cet appel partirait vers files.slack.com pour de bon — avec le jeton
  // de production du poste. Le mur vaut pour toute sortie, pas seulement pour l'API.
  await assert.rejects(() => telechargerFichier(JETON, capture()), /CLOISON D'ESSAIS/);
});

// ═════════════ T-20260806-0134 — le message arrive même quand l'image ne suit pas

test('UNE RÉCUPÉRATION QUI ÉCHOUE NE BLOQUE JAMAIS LE MESSAGE (RA-REL-010)', async () => {
  const m = espace({ fichiers: {} }); // l'adresse ne répond rien
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole());

  assert.equal(v.herdr.remis.length, 1, 'perdre trois phrases parce qu’une image n’a pas suivi est le vrai coût');
  const cadre = v.herdr.remis[0].texte;
  assert.ok(cadre.includes('voilà ce que je vois'), 'le texte du client atteint l’agent');
  assert.match(cadre, /pas pu|n’a pas|absente/i, 'le cadre dit à l’agent qu’une pièce manque');
  assert.equal(m.postes.length, 1, 'et celui qui l’a envoyée l’apprend');
});

test('PLUS DE 5 Mo : rien n’est téléchargé, et le client reçoit une phrase qui lui dit la limite', async () => {
  // Une capture pleine page ou un PDF numérisé dépasse la limite sans difficulté. Elle est
  // celle du registre des demandes, et elle se constate sur ce que Slack ANNONCE — avant de
  // rapatrier six mégaoctets pour les refuser ensuite.
  const m = espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole({ files: [capture({ name: 'page-entiere.png', size: TAILLE_MAX + 1 })] }));

  assert.equal(telechargements().length, 0, 'on ne rapatrie pas un fichier qu’on refusera de toute façon');
  assert.equal(v.herdr.remis.length, 1, 'le message passe');
  assert.equal(m.postes.length, 1, 'le client l’apprend — jamais un échec silencieux');
  assert.match(m.postes[0].text, /5 Mo/i, 'la phrase doit dire la limite, sinon elle n’aide personne');
});

test('UNE VIDÉO S’ENTEND DIRE QUE SON TYPE NE PASSE PAS, pas qu’elle est trop lourde', async () => {
  // L'ORDRE DES DEUX REFUS SE JOUE ICI, et il se voit sur le cas le plus probable : la vidéo,
  // qui est à la fois trop lourde ET d'un type qu'on ne peut pas recevoir. Lui parler de la
  // limite de 5 Mo l'enverrait compresser sa vidéo pour se la faire refuser une seconde fois.
  // Le refus de type est DÉFINITIF, celui de taille est négociable : le définitif prime.
  const m = espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole({ files: [capture({ name: 'demo.mp4', mimetype: 'video/mp4', size: TAILLE_MAX + 1 })] }));

  assert.equal(telechargements().length, 0);
  assert.equal(v.herdr.remis.length, 1, 'le message passe');
  assert.equal(m.postes.length, 1);
  assert.match(m.postes[0].text, /type de fichier/i, 'ce qu’il doit apprendre, c’est que ça ne passera jamais');
  assert.ok(!/5 Mo/i.test(m.postes[0].text), 'lui parler de la taille l’enverrait compresser pour rien');
});

test('UN FICHIER NON-IMAGE ne fait pas échouer le traitement du message', async () => {
  const m = espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole({ files: [capture({ name: 'journaux.zip', mimetype: 'application/zip', size: 400 })] }));

  assert.equal(telechargements().length, 0, 'un type qu’on ne peut pas recevoir se refuse avant de coûter un appel');
  assert.equal(v.herdr.remis.length, 1, 'le message du client arrive');
  assert.equal(m.postes.length, 1, 'et il apprend quels types passent');
  assert.match(m.postes[0].text, /PDF|image/i);
});

test('DEUX PIÈCES REFUSÉES POUR LA MÊME RAISON ne produisent qu’une seule réponse', async () => {
  // Un lieu de conversation qu'on inonde cesse d'être lu.
  const m = espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(
    parole({
      files: [
        capture({ id: 'F1', name: 'a.zip', mimetype: 'application/zip', size: 10 }),
        capture({ id: 'F2', name: 'b.zip', mimetype: 'application/zip', size: 10 }),
      ],
    })
  );

  assert.equal(m.postes.length, 1, 'une raison, une phrase');
});

test('CE QU’ON CACHE AU CLIENT, on le dit au dirigeant', async () => {
  // Même échec, deux natures de ligne. Le client ne lit ni notre outillage, ni nos codes de
  // dossier, ni un message d'erreur ; le dirigeant, lui, a besoin du détail pour agir.
  const client = espace({ fichiers: {} });
  const vClient = veilleur();
  vClient.registre.lignes.push(ligne());
  await vClient.remettreAuChantier(parole());

  const dit = client.postes[0].text;
  for (const mot of ['pane', 'veilleur', 'worktree', 'herdr', 'chantier', 'agent', 'registre', 'socket']) {
    assert.ok(!dit.toLowerCase().includes(mot), `« ${mot} » ne part pas chez un client — reçu : ${dit}`);
  }
  assert.ok(!dit.includes('D-20260805-0005'), 'le code du dossier ne part pas chez un client');

  monde.restaurer();
  sauverRegistre({ version: 1, lignes: [] });
  const interne = espace({ fichiers: {} });
  const vInterne = veilleur();
  vInterne.registre.lignes.push(ligne({ nature: 'interne', canal_nom: 'd-20260805-0005', autorises: ['UCLIENT'] }));
  await vInterne.remettreAuChantier(parole());

  assert.equal(interne.postes.length, 1, 'le dirigeant aussi apprend qu’une pièce n’est pas passée');
  assert.notEqual(interne.postes[0].text, dit, 'les deux registres de langage ne disent pas la même chose');
});

test('UNE PIÈCE SANS UN MOT : le cadre le dit, plutôt que de remettre un message qui paraît vide', async () => {
  espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole({ text: '' }));

  assert.equal(v.herdr.remis.length, 1);
  const cadre = v.herdr.remis[0].texte;
  assert.match(cadre, /aucun texte/i, 'l’agent doit comprendre qu’il n’y a rien à lire que la pièce');
  assert.ok(cadre.includes('capture.png'));
});

// ═════════════════ T-20260806-0135 — la pièce se rattache à la demande, pas au fil

test('LE CADRE RAPPELLE que la pièce se rattache à la demande, et que le fil ne fait pas foi', async () => {
  espace();
  const v = veilleur();
  v.registre.lignes.push(ligne());

  await v.remettreAuChantier(parole());

  const cadre = v.herdr.remis[0].texte;
  assert.match(cadre, /demande/i, 'le cadre doit dire où la pièce doit atterrir');
  assert.match(cadre, /ne fait pas foi|pas seulement dans le fil/i, 'et pourquoi le fil ne suffit pas');
});

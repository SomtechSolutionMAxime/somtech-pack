// Le canal d'un client appartient AU CLIENT, pas au chantier — et il ne suit donc pas son sort.
//
// Le défaut, découvert en écrivant la compétence de relation client : quand la session qui
// tient un canal disparaît, la réconciliation referme la ligne, ANNONCE la disparition dans
// le canal, et l'ARCHIVE. Un canal archivé est en lecture seule. Sur un canal interne c'est
// exactement ce qu'on veut — le chantier est fini, le canal n'a plus d'objet. Sur un canal
// client, c'est une porte qu'on ferme au nez de quelqu'un qui n'a rien demandé : il ne peut
// plus écrire, et aucune session neuve ne peut reprendre la relation.
//
// La règle tranchée : la disparition de notre session est un ÉVÉNEMENT INTERNE. On ne dit
// rien au client — notre session est morte, la sienne continue. Le silence s'arrête au
// moment où il écrit : là il apprend que personne n'est au bout du fil, et cette phrase-là
// ne doit surtout pas laisser entendre que la conversation est finie. Elle ne l'est pas.
//
// Chaque test a été vérifié par la mutation qu'il est censé attraper.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let Veilleur, sauverRegistre, chargerRegistre, lignesOuvertes, CAUSES, reponse;
let racine;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-canal-client-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre, lignesOuvertes } = await import('../src/registre.js'));
  ({ CAUSES, reponse } = await import('../src/langage.js'));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [] }));

/** Le double retient les archivages : c'est l'effet irréversible qu'on surveille ici. */
function slackDouble({ membres = [], canalExistant = null } = {}) {
  return {
    postes: [],
    archives: [],
    crees: [],
    async poster(_j, m) {
      this.postes.push(m);
      return '1';
    },
    async creerCanal(_j, nom, prive) {
      this.crees.push({ nom, prive });
      // Un canal déjà présent dans l'espace est REPRIS, pas recréé — c'est ce qui permet à
      // une session neuve de se rattacher à la conversation d'un client.
      //
      // ET UN CANAL ARCHIVÉ NE SE REJOINT PAS. C'est la règle de Slack, et sans elle ce
      // double serait plus permissif que le vrai service : le test du rattachement
      // passerait au vert même quand le canal vient d'être archivé, c'est-à-dire
      // précisément dans le cas qu'il existe pour attraper. Le chantier a déjà payé cette
      // leçon une fois.
      if (canalExistant && canalExistant.nom === nom) {
        if (this.archives.includes(canalExistant.id)) {
          throw new Error('is_archived — un canal archivé est en lecture seule');
        }
        return { ...canalExistant, reutilise: true };
      }
      return { id: `C_${nom}`, nom, prive: Boolean(prive), reutilise: false };
    },
    async membresDuCanal() {
      return membres;
    },
    async definirSujet() {},
    async inviter() {},
    async archiverCanal(_j, canal) {
      this.archives.push(canal);
      return true;
    },
    async nomDeMembre() {
      return 'Camille';
    },
  };
}

/** `agents()` ne rend QUE les panes vivants — un pane absent d'ici a disparu. */
function herdrDouble({ panesVivants = ['w1:p1'] } = {}) {
  return {
    async vivant(pane) {
      return panesVivants.includes(pane);
    },
    async remettre() {
      return {};
    },
    async agents() {
      return panesVivants.map((p) => ({ agent: 'claude', pane_id: p }));
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

/** Une ligne inscrite au registre, dont le pane a disparu. */
function ligneOrpheline(nature) {
  return {
    chantier: nature === 'client' ? 'acme' : 'D-20260805-0005',
    canal_id: 'C_acme',
    canal_nom: 'acme',
    pane: 'w9:pDISPARU',
    worktree: '/w/ancienne-session',
    nature,
    libelle: nature === 'client' ? 'Acme' : 'D-20260805-0005',
    autorises: nature === 'client' ? [] : ['UDIR'],
    visage: '🧭',
    ouverte_le: 'hier',
    close_le: null,
  };
}

// ═════════════════════ la disparition de notre session ne ferme pas le canal du client

test('CLIENT — la session disparaît : la ligne se referme au registre, le canal RESTE OUVERT', async () => {
  sauverRegistre({ version: 1, lignes: [ligneOrpheline('client')] });
  const s = slackDouble({ membres: ['UCLIENT'] });
  const v = veilleur({ slack: s, herdr: herdrDouble({ panesVivants: ['w1:p1'] }) });

  await v.reconcilier();

  assert.deepEqual(lignesOuvertes(chargerRegistre()), [], 'la ligne est bien close au registre');
  assert.deepEqual(s.archives, [], 'le canal du client ne doit PAS être archivé — il lui appartient');
});

test('CLIENT — la session disparaît : on ne dit RIEN au client, c’est un événement interne', async () => {
  sauverRegistre({ version: 1, lignes: [ligneOrpheline('client')] });
  const s = slackDouble({ membres: ['UCLIENT'] });
  const v = veilleur({ slack: s, herdr: herdrDouble({ panesVivants: ['w1:p1'] }) });

  await v.reconcilier();

  assert.deepEqual(s.postes, [], 'notre session est morte, la sienne continue : il n’a rien à en savoir');
});

test('INTERNE — NON-RÉGRESSION : la ligne se referme, le canal s’archive, et le dirigeant l’apprend', async () => {
  sauverRegistre({ version: 1, lignes: [ligneOrpheline('interne')] });
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble({ panesVivants: ['w1:p1'] }) });

  await v.reconcilier();

  assert.deepEqual(lignesOuvertes(chargerRegistre()), [], 'la ligne est close');
  assert.deepEqual(s.archives, ['C_acme'], 'un canal de chantier s’archive : le chantier est fini');
  assert.equal(s.postes.length, 1, 'et le dirigeant apprend que la ligne se referme');
  assert.equal(s.postes[0].nom, 'Ligne directe');
});

test('CLIENT — le message qui arrive après la disparition n’archive rien non plus', async () => {
  sauverRegistre({ version: 1, lignes: [ligneOrpheline('client')] });
  const s = slackDouble({ membres: ['UCLIENT'] });
  const v = veilleur({ slack: s, herdr: herdrDouble({ panesVivants: [] }) });

  await v.remettreAuChantier({ type: 'message', channel: 'C_acme', user: 'UCLIENT', text: 'des nouvelles ?' });

  assert.deepEqual(s.archives, [], 'écrire dans son propre canal ne doit pas le lui fermer');
  assert.equal(s.postes.length, 1, 'le silence s’arrête quand il écrit — il reçoit une réponse');
});

// ═════════════════════ une session neuve reprend la conversation

test('CLIENT — une session NEUVE se rattache au canal et reprend la relation', async () => {
  // Le canal existe toujours dans l'espace : c'est parce qu'il n'a pas été archivé qu'une
  // session neuve peut s'y installer. C'est tout l'objet du relèvement.
  sauverRegistre({ version: 1, lignes: [ligneOrpheline('client')] });
  const canalExistant = { id: 'C_acme', nom: 'acme', prive: true };
  const s = slackDouble({ membres: ['UCLIENT'], canalExistant });
  const v = veilleur({ slack: s, herdr: herdrDouble({ panesVivants: ['w1:p1'] }) });

  await v.reconcilier();
  const r = await v.ouvrir({
    chantier: 'acme',
    pane: 'w1:p1',
    worktree: '/w/session-neuve',
    nature: 'client',
    titre: 'acme',
  });

  assert.equal(r.ok, true, `la session neuve doit pouvoir se rattacher : ${r.erreur}`);
  assert.equal(r.canal_id, 'C_acme', 'et sur LE MÊME canal, pas sur un doublon');
  assert.equal(r.canal_reutilise, true, 'le canal est repris, pas recréé');

  // Et la parole du client repart vers la session neuve.
  const herdrNeuf = herdrDouble({ panesVivants: ['w1:p1'] });
  const remis = [];
  herdrNeuf.remettre = async (pane, texte) => {
    remis.push({ pane, texte });
    return {};
  };
  const v2 = veilleur({ slack: s, herdr: herdrNeuf });
  await v2.remettreAuChantier({ type: 'message', channel: 'C_acme', user: 'UCLIENT', text: 'des nouvelles ?' });

  assert.equal(remis.length, 1, 'le message du client atteint la session neuve');
  assert.equal(remis[0].pane, 'w1:p1');
});

// ═════════════════════ ce qu'on lui dit quand il écrit : jamais une fin

/** Le vocabulaire de la fin définitive — il ment, puisque la conversation reprendra. */
const ANNONCE_UNE_FIN = /(se termine|terminée|terminé|prend fin|dernière|clôtur|définitiv)/i;

test('CLIENT — aucune réponse automatique ne laisse entendre que la conversation est finie', async () => {
  // La conversation n'est PAS finie : elle reprend dès qu'une session neuve se rattache.
  // Lui annoncer une fin, c'est lui mentir — et le pousser à repartir par courriel, ce que
  // toute cette fonction existe pour supprimer.
  for (const cause of CAUSES) {
    const texte = reponse(cause, 'client', { chantier: 'D-1', pane: 'w1:p1', close_le: '2026-08-06', erreur: 'x' });
    assert.ok(!ANNONCE_UNE_FIN.test(texte), `« ${cause} » annonce une fin au client : « ${texte} »`);
  }
});

test('CLIENT — mais chaque réponse dit bien que le message n’est pas passé', async () => {
  // Ne pas annoncer de fin ne veut pas dire rester vague : RA-REL-009 exige que celui qui
  // a écrit l'apprenne. Une phrase rassurante qui laisse croire à une remise serait pire
  // que le silence.
  for (const cause of CAUSES.filter((c) => c !== 'reprise_agent_disparu')) {
    const texte = reponse(cause, 'client', {});
    assert.match(texte, /pas été transmis|pas pu être transmis/, `« ${cause} » ne dit pas que le message n’est pas passé : ${texte}`);
  }
});

test('INTERNE — NON-RÉGRESSION : le registre interne est libre de dire la fin, et il la dit', async () => {
  // Sur une ligne interne, une ligne close EST close : le chantier est fini, le canal
  // archivé. Le langage interne n'a aucune raison de s'adoucir, et le vérifier ici empêche
  // qu'on « harmonise » les deux registres par mégarde.
  const texte = reponse('ligne_close', 'interne', { close_le: '2026-08-06', chantier: 'D-1' });
  assert.match(texte, /close/, 'le dirigeant s’entend dire que la ligne est close');
  assert.match(texte, /D-1/, 'et de quel chantier il s’agit');
});

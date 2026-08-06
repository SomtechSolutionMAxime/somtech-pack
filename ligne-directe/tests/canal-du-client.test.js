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
          // La vraie classe, pas une chaîne qui y ressemble : un double qui invente sa
          // propre forme d'échec laisse passer un appelant qui ne sait pas la reconnaître.
          const { CanalArchive } = await import('../src/slack.js');
          throw new CanalArchive(canalExistant.nom, canalExistant.id);
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

test('CLIENT — FERMER une ligne cliente n’archive pas son canal non plus', async () => {
  // Relevé en revue, et c'est la TROISIÈME fois de ce chantier qu'un correctif ne couvre
  // qu'une porte sur deux. La règle porte sur le canal, pas sur le chemin qui y mène :
  // qu'on disparaisse ou qu'on referme volontairement, il appartient toujours au client.
  //
  // Refermer sa ligne veut dire « je n'écoute plus », jamais « ce lieu n'existe plus ».
  sauverRegistre({ version: 1, lignes: [ligneOrpheline('client')] });
  const s = slackDouble({ membres: ['UCLIENT'] });
  const v = veilleur({ slack: s, herdr: herdrDouble() });

  const r = await v.fermer({ chantier: 'acme', worktree: '/w/ancienne-session', bilan: 'c’est en ligne' });

  assert.equal(r.ok, true, r.erreur);
  assert.equal(r.archive, false, 'la réponse doit dire la vérité sur l’archivage');
  assert.deepEqual(s.archives, [], 'le canal du client ne s’archive pas, même sur un geste explicite');
  assert.equal(s.postes.length, 1, 'le bilan part quand même');
  assert.deepEqual(lignesOuvertes(chargerRegistre()), [], 'et la ligne est bien close');
});

test('INTERNE — NON-RÉGRESSION : fermer archive le canal, et le bilan part AVANT', async () => {
  sauverRegistre({ version: 1, lignes: [ligneOrpheline('interne')] });
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble() });

  const r = await v.fermer({ chantier: 'D-20260805-0005', worktree: '/w/ancienne-session', bilan: 'livré' });

  assert.equal(r.archive, true);
  assert.deepEqual(s.archives, ['C_acme']);
  assert.equal(s.postes.length, 1, 'un canal archivé est en lecture seule : le bilan doit partir avant');
});

test('LES CHEMINS QUI ARCHIVENT SONT ÉNUMÉRÉS — un troisième ne peut pas apparaître en silence', async () => {
  // Ce test ne prouve pas un comportement, il prouve une COUVERTURE — et c'est lui qui
  // répond au motif que ce chantier répète : un correctif appliqué à une porte pendant
  // qu'une autre reste ouverte, trois fois de suite.
  //
  // Deux chemins archivent, et deux seulement : le geste explicite et la reprise du
  // service. Chacun est éprouvé au-dessus, dans les deux natures. Un troisième site
  // ajouté demain fait rougir ici AVANT qu'on découvre en production qu'il ferme le canal
  // d'un client.
  //
  // ⚠️ CE QUE CETTE GARDE NE VOIT PAS, et il ne faut pas la croire étanche : elle lit du
  // TEXTE. Un alias la contourne — `const archiver = this.slack.archiverCanal; archiver(…)`
  // ne ressemble plus au motif cherché, et un troisième chemin passerait. Une garde
  // étanche demanderait d'instrumenter l'adaptateur lui-même plutôt que de lire sa source.
  // Elle vaut contre l'oubli, qui est le mode de panne observé trois fois sur ce chantier ;
  // elle ne vaut pas contre une réécriture qui la déjoue.
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const source = readFileSync(fileURLToPath(new URL('../src/veilleur.js', import.meta.url)), 'utf8');

  const SITES = ['fermer', 'reconcilier'];
  const methodeContenant = (texte, position) => {
    const avant = texte.slice(0, position);
    const noms = [...avant.matchAll(/^\s{2}(?:async\s+)?([a-zA-Zà-ÿ_$][\w$]*)\s*\(/gm)];
    return noms.length ? noms[noms.length - 1][1] : '(hors méthode)';
  };

  const archivages = [...source.matchAll(/this\.slack\.archiverCanal\(/g)];
  assert.equal(archivages.length, SITES.length, `${archivages.length} archivage(s) trouvé(s) pour ${SITES.length} site(s) éprouvé(s)`);

  const vus = new Set();
  for (const a of archivages) {
    const methode = methodeContenant(source, a.index);
    assert.ok(SITES.includes(methode), `un canal est archivé depuis « ${methode} », qu’aucun test ne garde`);
    vus.add(methode);
  }
  assert.deepEqual([...vus].sort(), [...SITES].sort(), 'chaque site énuméré doit exister et être le seul');
});

// ═════════════════════ un canal archivé est perdu — le code ne doit pas prétendre le rattraper

// Ce que ces deux tests gardent, et pourquoi ils ne cherchent PAS des mots-clés.
//
// La première version vérifiait que le message contenait « archivé » et « à la main ».
// Remplacer tout le texte par « réessaie dans quelques minutes » — le contresens exact,
// puisque justement il ne faut jamais réessayer — laissait 163 tests verts. Une garde qui
// vérifie ce qu'un texte CONTIENT ne prouve rien de ce qu'il DIT.
//
// D'où le déplacement : chaque refus définitif porte `reessayable = false`, un fait que le
// code UTILISE pour décider s'il relaie. Les tests ci-dessous gardent la cohérence entre ce
// fait et le texte — un refus qui se déclare définitif et invite à patienter se contredit
// lui-même — plus l'absence de tout conseil destructeur. Les deux valent pour les refus à
// venir, pas seulement pour les deux d'aujourd'hui.

/** Inviter à patienter sur un refus définitif est un contresens : rien ne changera. */
const INVITE_A_PATIENTER = /(réessa|ressa|retent|renvoie|plus tard|dans (quelques|un) (instants?|minutes?|moments?))/i;

/** Un conseil qui détruit sans retour n'a rien à faire dans un message de refus. */
const CONSEILLE_DE_DETRUIRE = /\barchive[rz]?\s+(le\s+|ce\s+)?(canal|#)/i;

/** Tous les refus définitifs de la couche Slack, instanciés comme le code les lève. */
async function refusDefinitifs() {
  const { ConfidentialiteIncompatible, CanalArchive } = await import('../src/slack.js');
  return [
    new CanalArchive('acme', 'C_arch'),
    new ConfidentialiteIncompatible('acme', true, false),
    new ConfidentialiteIncompatible('acme', false, true),
  ];
}

test('AUCUN refus définitif n’invite à patienter — ce serait se contredire soi-même', async () => {
  for (const refus of await refusDefinitifs()) {
    assert.equal(refus.reessayable, false, `${refus.name} doit se déclarer définitif`);
    assert.ok(
      !INVITE_A_PATIENTER.test(refus.message),
      `${refus.name} se déclare définitif et invite pourtant à patienter : « ${refus.message} »`
    );
  }
});

test('AUCUN refus ne conseille un geste qui détruit sans retour', async () => {
  // Le refus de confidentialité conseillait « ou archive le canal #X ». Suivre ce conseil
  // libère bien le nom — et détruit sans retour un canal d'équipe, puisqu'on ne sait pas
  // désarchiver. Un refus qui recommande ce qu'un autre refus existe pour empêcher est un
  // référentiel qui se contredit d'un fichier à l'autre.
  for (const refus of await refusDefinitifs()) {
    assert.ok(
      !CONSEILLE_DE_DETRUIRE.test(refus.message),
      `${refus.name} conseille d’archiver un canal : « ${refus.message} »`
    );
  }
});

test('un refus définitif dit OÙ agir — sinon il ferme la porte sans en donner la clé', async () => {
  // Le pendant positif des deux gardes ci-dessus : refuser sans dire quoi faire transforme
  // une impasse de trente secondes en enquête. Chaque refus nomme le canal concerné et un
  // geste concret hors de la portée du code.
  for (const refus of await refusDefinitifs()) {
    assert.match(refus.message, /#acme/, `${refus.name} doit nommer le canal concerné`);
    assert.match(
      refus.message,
      /(à la main|dans Slack|--titre)/i,
      `${refus.name} doit dire quel geste lève la situation : « ${refus.message} »`
    );
  }
});

test('le veilleur relaie un refus sur le FAIT qu’il est définitif, pas sur son nom', async () => {
  // Une liste de noms d'erreurs oublie toujours la prochaine. Une erreur définitive inédite
  // doit déjà être relayée telle quelle — sinon elle remonte en trace de pile et la seule
  // phrase utile se perd.
  const { RefusDefinitif } = await import('../src/slack.js');
  const inedit = new RefusDefinitif('#acme est verrouillé par une politique de l’espace — fais-le lever à la main dans Slack.');

  const s = slackDouble();
  s.creerCanal = async () => {
    throw inedit;
  };
  const v = veilleur({ slack: s, herdr: herdrDouble() });
  const r = await v.ouvrir({ chantier: 'acme', pane: 'w1:p1', worktree: '/w/a', nature: 'client', titre: 'acme' });

  assert.equal(r.ok, false);
  assert.equal(r.erreur, inedit.message, 'le message doit être relayé tel quel');
});

test('un canal archivé ne se rattrape PAS : le refus le dit, et rien n’est tenté', async () => {
  // `conversations.unarchive` n'accepte pas un jeton de robot, et c'est le seul dont ce
  // code dispose. Le tenter quand même donnait au lecteur — et aux tests — la certitude
  // fausse qu'un canal archivé se récupère. Il ne se récupère pas : il est perdu, y compris
  // pour les canaux clients archivés avant ce correctif.
  //
  // On ne tente donc plus, et on refuse en NOMMANT l'impossibilité et le geste humain qui
  // la lève. Une impasse expliquée vaut trente secondes ; une impasse muette vaut une
  // enquête.
  const { fauxSlack } = await import('./aide/faux-slack.js');
  const { creerCanal, CanalArchive } = await import('../src/slack.js');

  const monde = fauxSlack({
    canaux: [{ id: 'C_arch', name: 'acme', is_private: true, is_archived: true, membres: [] }],
  }).installer();
  try {
    const echec = await creerCanal('jeton-robot', 'acme', true).then(
      () => null,
      (err) => err
    );
    assert.ok(echec, 'reprendre un canal archivé doit échouer');
    assert.equal(echec.name, 'CanalArchive', `erreur inattendue : ${echec?.message}`);
    assert.ok(echec instanceof CanalArchive, 'la cause est une erreur nommée, pas une chaîne à reconnaître');
    assert.equal(echec.reessayable, false, 'et un fait que l’appelant peut lire, pas seulement une phrase');

    assert.deepEqual(
      monde.appels.filter((a) => a.methode === 'conversations.unarchive'),
      [],
      'aucun désarchivage ne doit être tenté : on sait déjà qu’il échouerait'
    );
  } finally {
    monde.restaurer();
  }
});

test('l’ouverture d’une ligne sur un canal archivé rend un refus lisible, pas une trace de pile', async () => {
  const s = slackDouble();
  s.creerCanal = async () => {
    const { CanalArchive } = await import('../src/slack.js');
    throw new CanalArchive('acme', 'C_arch');
  };
  const v = veilleur({ slack: s, herdr: herdrDouble() });

  const r = await v.ouvrir({ chantier: 'acme', pane: 'w1:p1', worktree: '/w/a', nature: 'client', titre: 'acme' });

  assert.equal(r.ok, false);
  assert.match(r.erreur, /archiv/i, 'le refus doit nommer la cause');
  assert.deepEqual(chargerRegistre().lignes, [], 'et rien ne doit être inscrit');
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

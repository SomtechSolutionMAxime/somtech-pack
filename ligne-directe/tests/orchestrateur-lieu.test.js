// Le lieu de l'orchestrateur — sa pose, et surtout son REFUS (E-20260813-0002).
//
// Le critère du brief, mot pour mot : « le refus se prouve par l'ABSENCE sur disque, jamais
// par le message affiché ». Chaque test de refus, ci-dessous, inspecte le système de
// fichiers après l'appel — le texte de la réponse n'est jamais l'assertion.
//
// TROIS PORTES mènent au point d'écriture de `lieu-agent.js`, et les trois sont éprouvées
// séparément ici : l'idempotence, la source, la ligne. Le compte est tenu par
// `portes-qui-ecrivent.test.js`, pour que le motif « une porte sur deux » — quatre
// occurrences sur ce dépôt — ait un test qui rougisse plutôt qu'un commentaire qui rassure.
//
// CE QUE CETTE SUITE NE PROUVE PAS, ET QUI EST PROUVÉ AILLEURS
// Qu'une VRAIE session naît dans ce lieu, qu'elle commence, et que deux orchestrateurs y
// cohabitent pour de vrai : `scripts/tests/test-naissance-orchestrateur-reel.sh`, contre le
// vrai gestionnaire de panes. Un double serait plus indulgent que le vrai service — c'est la
// racine unique des sept défauts du lot jumeau.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparerLieuOrchestrateur, verifierLigneOuvrable } from '../src/orchestrateur.js';
import { preparerLieuRepresentant } from '../src/representant.js';
import { etatLieu, GABARITS } from '../src/lieu-agent.js';
import { JetonManquant, JetonVide, SERVICE_ROBOT, SERVICE_ECOUTE } from '../src/trousseau.js';
import { variablesReferencees } from '../src/mcp-env.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const GABARITS_SRC = join(REPO, '.claude', 'templates');

/** Un dépôt jetable, avec les gabarits du pack déjà « installés » (précondition du lot). */
function depotJetable({ roles = ['orchestrateur'] } = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'ld-orch-'));
  for (const r of roles) {
    cpSync(join(GABARITS_SRC, r), join(racine, '.claude', 'templates', r), { recursive: true });
  }
  return racine;
}

const OUVRABLE = async () => ({ joignable: true });
const SANS_JETON = async () => ({ joignable: false, motif: 'jeton_absent', message: 'aucune entrée ne répond' });
const NE_DOIT_JAMAIS_ETRE_APPELEE = async () => {
  throw new Error('la ligne a été vérifiée alors que le lieu existait déjà — la garde d’idempotence a été contournée');
};

// ═══════════════════════════════ 1. la porte de la LIGNE — elle est obligatoire

test('refus : le poste ne peut pas ouvrir de ligne — RIEN n’a été créé (prouvé par le disque)', async () => {
  const depot = depotJetable();
  const r = await preparerLieuOrchestrateur({ depot, nom: 'd-20260813-0002', verifierLigne: SANS_JETON });

  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'jeton_absent');
  // L'ASSERTION EST CELLE-CI, et elle seule : le dossier ne doit pas même exister. Un test
  // qui lirait le message passerait sur une pose qui refuse en beauté après avoir écrit.
  assert.equal(existsSync(join(depot, '.orchestrateur')), false, 'le dossier .orchestrateur ne doit pas même exister');
});

test('la ligne est OBLIGATOIRE : la pose ne peut pas aboutir sans elle, quelle que soit la cause', async () => {
  // La décision du dirigeant (2026-08-12) CORRIGE ce que la compétence disait — « continue
  // sans elle » a disparu du métier. Ce test est le pendant mécanique de ce retrait : aucune
  // valeur de `motif` ne doit ouvrir un chemin vers l'écriture.
  for (const motif of ['jeton_absent', 'jeton_vide', 'autre_chose', undefined]) {
    const depot = depotJetable();
    const r = await preparerLieuOrchestrateur({
      depot, nom: 'd-1', verifierLigne: async () => ({ joignable: false, motif }),
    });
    assert.equal(r.ok, false, `motif « ${motif} » : la pose a abouti sans ligne`);
    assert.equal(existsSync(join(depot, '.orchestrateur')), false, `motif « ${motif} » : un lieu a été créé sans ligne`);
  }
});

// ═══════════════════════════════ 2. la porte de la SOURCE

test('refus : les gabarits manquent au dépôt — RIEN n’a été créé, et la ligne n’a pas été sollicitée', async () => {
  const depot = mkdtempSync(join(tmpdir(), 'ld-orch-nu-'));
  const r = await preparerLieuOrchestrateur({ depot, nom: 'd-1', verifierLigne: NE_DOIT_JAMAIS_ETRE_APPELEE });

  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'gabarits_absents');
  assert.equal(existsSync(join(depot, '.orchestrateur')), false);
});

test('refus : les gabarits sont là mais INCOMPLETS — un pack à demi déposé ne passe pas', async () => {
  // T-20260807-0067 : vérifier la présence du RÉPERTOIRE de gabarits n'aurait corrigé qu'une
  // porte sur deux. On ampute d'UN SEUL fichier, celui qui se remarque le moins.
  const depot = depotJetable();
  rmSync(join(depot, '.claude', 'templates', 'orchestrateur', '.claude', 'settings.json'));

  const r = await preparerLieuOrchestrateur({ depot, nom: 'd-1', verifierLigne: NE_DOIT_JAMAIS_ETRE_APPELEE });
  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'gabarits_absents');
  assert.deepEqual(r.refus.manquants, [join('.claude', 'settings.json')]);
  assert.equal(existsSync(join(depot, '.orchestrateur')), false);
});

// ═══════════════════════════════ 3. la porte de l'IDEMPOTENCE

test('la pose crée les QUATRE fichiers, settings.json sous .claude/ et pas à plat', async () => {
  const depot = depotJetable();
  const r = await preparerLieuOrchestrateur({ depot, nom: 'd-20260813-0002', verifierLigne: OUVRABLE });

  assert.equal(r.ok, true);
  assert.equal(r.cree, true);
  for (const f of GABARITS) {
    assert.ok(existsSync(join(depot, '.orchestrateur', 'd-20260813-0002', f)), `${f} n’a pas été posé`);
  }
  // Le défaut vécu : les quatre à plat. `.mcp.json` marchait, ce qui a caché que
  // `settings.json` était mort au même endroit — posé, présent, jamais lu.
  assert.equal(
    existsSync(join(depot, '.orchestrateur', 'd-20260813-0002', 'settings.json')), false,
    'settings.json a été posé à plat : Claude Code ne l’y lit jamais',
  );
});

test('relancée sur un lieu complet : rien n’est retouché — CONTENU comparé, pas horodatage', async () => {
  const depot = depotJetable();
  await preparerLieuOrchestrateur({ depot, nom: 'd-1', verifierLigne: OUVRABLE });

  const lieu = join(depot, '.orchestrateur', 'd-1');
  // On MARQUE le lieu comme un humain l'aurait fait, puis on relance : ce qui est à lui doit
  // survivre intact. C'est la garantie que « elle ne recrée rien, n'écrase rien » recouvre.
  writeFileSync(join(lieu, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n\nécrit à la main\n');
  const avant = Object.fromEntries(GABARITS.map((f) => [f, readFileSync(join(lieu, f), 'utf8')]));

  // `NE_DOIT_JAMAIS_ETRE_APPELEE` prouve en plus que relancer ne coûte AUCUN appel réseau :
  // la garde d'idempotence est bien la première des trois.
  const r = await preparerLieuOrchestrateur({ depot, nom: 'd-1', verifierLigne: NE_DOIT_JAMAIS_ETRE_APPELEE });
  assert.equal(r.ok, true);
  assert.equal(r.cree, false);
  assert.equal(r.deja_installe, true);

  for (const f of GABARITS) {
    assert.equal(readFileSync(join(lieu, f), 'utf8'), avant[f], `${f} a été retouché par une relance`);
  }
});

test('un lieu amputé d’UN SEUL fichier n’est JAMAIS déclaré installé — et n’est pas complété', async () => {
  // Le plus grave des sept défauts : un répertoire créé puis abandonné EXISTE sans être un
  // lieu. `presents: []` et `deja_installe: true` ne peuvent pas coexister — et un lieu à
  // qui il manque un seul fichier est dans le même cas, en moins visible.
  const depot = depotJetable();
  await preparerLieuOrchestrateur({ depot, nom: 'd-1', verifierLigne: OUVRABLE });
  const lieu = join(depot, '.orchestrateur', 'd-1');

  for (const ampute of GABARITS) {
    const sauvegarde = readFileSync(join(lieu, ampute), 'utf8');
    rmSync(join(lieu, ampute));

    const r = await preparerLieuOrchestrateur({ depot, nom: 'd-1', verifierLigne: NE_DOIT_JAMAIS_ETRE_APPELEE });
    assert.equal(r.ok, false, `amputé de ${ampute} : la pose a abouti`);
    assert.equal(r.deja_installe, false, `amputé de ${ampute} : déclaré installé`);
    assert.equal(r.refus.motif, 'lieu_partiel');
    assert.equal(
      existsSync(join(lieu, ampute)), false,
      `amputé de ${ampute} : la pose a COMPLÉTÉ un lieu à demi posé — elle ne sait pas ce qu’un humain y a changé`,
    );

    writeFileSync(join(lieu, ampute), sauvegarde);
    mkdirSync(dirname(join(lieu, ampute)), { recursive: true });
  }
});

// ═══════════════════════════════ 4. DEUX LIEUX, et le voisin qu'on n'emporte pas

test('deux orchestrateurs cohabitent dans le même dépôt, chacun avec son lieu nommé', async () => {
  // « Un projet d'envergure ouvrira un second orchestrateur quand le premier ne tiendra
  // plus. » Le lieu est NOMMÉ pour ça — un lieu anonyme ne se dédouble pas.
  const depot = depotJetable();
  const a = await preparerLieuOrchestrateur({ depot, nom: 'd-20260813-0002', verifierLigne: OUVRABLE });
  const b = await preparerLieuOrchestrateur({ depot, nom: 'p-20260720-0002', verifierLigne: OUVRABLE });

  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  for (const nom of ['d-20260813-0002', 'p-20260720-0002']) {
    assert.equal(etatLieu(depot, 'orchestrateur', nom).complet, true, `${nom} n’est pas complet après la pose du second`);
  }
});

test('une pose qui échoue N’EMPORTE PAS le lieu d’un voisin posé entre-temps', async () => {
  // Le défaut relevé en revue : décider de supprimer le dossier de rôle entier d'après un
  // `existsSync` lu AVANT l'écriture. Deux poses concurrentes lisent toutes deux « il
  // n'existait pas », et celle qui échoue emporte le lieu que l'autre venait de réussir.
  // Avec l'orchestrateur, ce cas passe du théorique au quotidien.
  const depot = depotJetable();
  await preparerLieuOrchestrateur({ depot, nom: 'voisin', verifierLigne: OUVRABLE });

  // On fait échouer le point d'écriture pour l'autre : un gabarit remplacé par un répertoire.
  const source = join(depot, '.claude', 'templates', 'orchestrateur', 'CLAUDE.md');
  rmSync(source);
  mkdirSync(source);

  const r = await preparerLieuOrchestrateur({ depot, nom: 'celui-qui-echoue', verifierLigne: OUVRABLE });
  assert.equal(r.ok, false, 'la pose aurait dû échouer sur un gabarit illisible');
  assert.equal(
    existsSync(join(depot, '.orchestrateur', 'celui-qui-echoue')), false,
    'un lieu à demi posé a survécu — la relance suivante le lirait comme un lieu',
  );
  assert.equal(
    etatLieu(depot, 'orchestrateur', 'voisin').complet, true,
    'le lieu du VOISIN a été emporté par l’échec de l’autre',
  );
});

// ═══════════════════════════════ 5. les deux rôles ne se croisent jamais

test('le rôle décide du dossier ET du gabarit — aucun croisement possible', async () => {
  const depot = depotJetable({ roles: ['orchestrateur', 'gestionnaire-client'] });
  await preparerLieuOrchestrateur({ depot, nom: 'meme-nom', verifierLigne: OUVRABLE });
  await preparerLieuRepresentant({
    depotClient: depot, client: 'meme-nom', canal: 'c', verifierJoignabilite: async () => ({ joignable: true }),
  });

  // Même nom, deux rôles : deux lieux distincts, chacun avec SON métier. Les croiser ferait
  // naître un orchestrateur qui se croirait représentant — et le garde d'ouverture, qui lit
  // le rôle dans l'en-tête du métier, lui présenterait la mauvaise séquence.
  const orch = readFileSync(join(depot, '.orchestrateur', 'meme-nom', 'CLAUDE.md'), 'utf8');
  const repr = readFileSync(join(depot, '.gestionnaire', 'meme-nom', 'CLAUDE.md'), 'utf8');
  assert.match(orch.split('\n')[0], /^# Tu es l'orchestrateur/);
  assert.match(repr.split('\n')[0], /^# Tu es le représentant/);
});

// ═══════════════════════════════ 6. le refus qui envoyait détruire (T-20260811-0087)

test('un jeton absent est rapporté comme CE QUI A ÉTÉ CHERCHÉ, sans commande qui écrase', async () => {
  // Le septième défaut : un jeton en place déclaré absent, et un message qui envoyait
  // « déposer » — donc écraser celui qui servait onze lignes. Deux garanties tenues ici :
  // le message dit le service ET le compte cherchés, et ne propose AUCUNE commande d'écrasement.
  const r = await verifierLigneOuvrable({
    lire: async () => {
      throw new JetonManquant(SERVICE_ROBOT, 'quelqun');
    },
  });

  assert.equal(r.joignable, false);
  assert.equal(r.motif, 'jeton_absent');
  assert.match(r.message, /quelqun/, 'le refus doit dire sous quel COMPTE il a cherché');
  assert.match(r.message, new RegExp(SERVICE_ROBOT), 'et pour quel service');
  assert.ok(
    !/add-generic-password[^\n]*-U/.test(r.message),
    'le refus met une commande qui ÉCRASE une entrée existante dans la bouche de qui le lit',
  );
});

test('un jeton VIDE n’est pas un jeton absent — le geste qui répare n’est pas le même', async () => {
  const r = await verifierLigneOuvrable({
    lire: async () => {
      throw new JetonVide(SERVICE_ECOUTE, 'quelqun');
    },
  });
  assert.equal(r.motif, 'jeton_vide');
});

test('la ligne sert à parler ET à entendre : le refus nomme les deux entrées', async () => {
  // Un orchestrateur qui posterait sans jamais recevoir la réponse du dirigeant serait sourd
  // en croyant dialoguer — pire que muet, pour un rôle dont la raison d'être est de faire
  // trancher ce qu'il ne doit pas trancher seul.
  const r = await verifierLigneOuvrable({
    lire: async () => {
      throw new JetonManquant(SERVICE_ECOUTE, 'quelqun');
    },
  });
  assert.match(r.message, new RegExp(SERVICE_ROBOT));
  assert.match(r.message, new RegExp(SERVICE_ECOUTE));
});

test('la vérification passe par le trousseau CLOISONNÉ — jamais par un chemin implicite', async () => {
  // `lireJetons` est le défaut de production, et elle refuse sous essais (cloison RA-REL-012).
  // Appeler la vérification SANS injection, ici, doit donc buter sur la cloison — pas lire
  // les vrais jetons. C'est ce qui empêche cette suite de faire naître un veilleur vers
  // l'espace de production, comme c'est déjà arrivé deux fois.
  const r = await verifierLigneOuvrable();
  assert.equal(r.joignable, false, 'la vérification a atteint le vrai trousseau depuis une suite de tests');
});

// ═══════════════════════════════ 7. l'accès au registre — LE CAS RÉVÉLATEUR (T-20260815-0023)
//
// POURQUOI CETTE SECTION EST ICI ALORS QUE LE CODE EST DÉJÀ ÉPROUVÉ CHEZ LE REPRÉSENTANT :
// le contrôle vit dans `lieu-agent.js`, commun aux deux rôles, et RIEN ne l'éprouvait de ce
// côté-ci — relevé par T-20260815-0023. Or c'est l'orchestrateur qui porte le cas décisif :
// son gabarit déclare DEUX variables, et l'une d'elles — `SOMCRAFT_MCP_API_KEY` — ne vit PAS
// dans un en-tête `Authorization` mais dans la CHAÎNE DE REQUÊTE d'une URL.
//
// C'est très exactement ce qui avait déjà mordu côté shell : une détection limitée aux
// en-têtes ratait Somcraft, et le serveur disparaissait de la session sans un mot (voir le
// commentaire en tête de `scripts/tests/test-mcp-env.sh`). La logique portée en JS ici hérite
// de ce défaut vécu ; ces cas sont ce qui l'empêche de le rejouer.

const GABARIT_ORCH = join(GABARITS_SRC, 'orchestrateur', '.mcp.json');

/** Ce que le gabarit réclame RÉELLEMENT — jamais une liste écrite à la main. */
const RECLAMEES = variablesReferencees(GABARIT_ORCH);

/** Celle qui vit dans l'URL, désignée PAR LE FICHIER — pas par une constante recopiée ici. */
function variableDansUrl() {
  const mcp = JSON.parse(readFileSync(GABARIT_ORCH, 'utf8'));
  for (const s of Object.values(mcp.mcpServers || {})) {
    const dans = [...String(s.url || '').matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]);
    if (dans.length) return dans[0];
  }
  return null;
}

/** Voir le jumeau dans `representant-lieu.test.js` : sans ça, la suite mesure le POSTE. */
async function avecEnvironnement(valeurs, f) {
  const avant = new Map();
  for (const [k, v] of Object.entries(valeurs)) {
    avant.set(k, Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await f();
  } finally {
    for (const [k, v] of avant) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const AUCUNE = () => Object.fromEntries(RECLAMEES.map((v) => [v, undefined]));
const poser = (depot, nom = 'd-1') => preparerLieuOrchestrateur({ depot, nom, verifierLigne: OUVRABLE });

test('le gabarit de l’orchestrateur déclare bien DEUX variables, dont une dans une URL', () => {
  // L'ancrage de toute la section : si le gabarit changeait au point de perdre son serveur
  // à jeton-dans-l'URL, les cas suivants deviendraient décoratifs sans que rien ne le dise.
  assert.equal(RECLAMEES.length, 2, `le gabarit devrait réclamer deux variables, il en réclame ${RECLAMEES.length}`);
  assert.ok(variableDansUrl(), 'aucune variable dans une URL : le cas le plus révélateur a disparu du gabarit');
  assert.ok(RECLAMEES.includes(variableDansUrl()), 'la variable de l’URL n’est pas comptée parmi les réclamées');
});

test('CRITÈRE 4 — la variable qui vit dans l’URL est TROUVÉE, pas seulement celle de l’en-tête', async () => {
  // On fournit TOUT SAUF celle de l'URL. Une détection limitée aux en-têtes `Authorization`
  // ne verrait plus rien à signaler et se tairait — l'orchestrateur naîtrait sans Somcraft,
  // exactement le défaut déjà payé côté shell.
  const urlVar = variableDansUrl();
  const depot = depotJetable();
  const fournies = Object.fromEntries(RECLAMEES.map((v) => [v, v === urlVar ? undefined : 'factice']));

  const r = await avecEnvironnement(fournies, () => poser(depot));

  assert.equal(r.cree, true);
  assert.equal(r.avertissements.length, 1, `« ${urlVar} » manque et rien ne le dit — elle vit dans l’URL, pas dans un en-tête`);
  assert.match(r.avertissements[0], new RegExp(urlVar), `l’avertissement ne nomme pas « ${urlVar} »`);
  for (const autre of RECLAMEES.filter((v) => v !== urlVar)) {
    assert.ok(
      !r.avertissements[0].includes(autre),
      `« ${autre} » est fournie et pourtant nommée manquante — l’avertissement doit nommer CE QUI MANQUE, pas tout`,
    );
  }
});

test('CRITÈRE 2 — ni fichier ni environnement : l’avertissement nomme LES DEUX variables', async () => {
  const depot = depotJetable();
  const r = await avecEnvironnement(AUCUNE(), () => poser(depot));

  assert.equal(r.cree, true, 'l’absence d’accès au registre ne bloque jamais la pose');
  assert.equal(r.avertissements.length, 1);
  for (const v of RECLAMEES) {
    assert.match(r.avertissements[0], new RegExp(v), `« ${v} » manque et n’est pas nommée`);
  }
});

test('CRITÈRE 1 — pas de .env, mais le processus porte les deux variables : AUCUN avertissement', async () => {
  const depot = depotJetable();
  const r = await avecEnvironnement(Object.fromEntries(RECLAMEES.map((v) => [v, 'factice'])), () => poser(depot));

  assert.equal(r.cree, true);
  assert.deepEqual(r.avertissements, [], 'des variables résolues par le processus ne doivent produire aucun avertissement');
});

test('CRITÈRE 3 — un .env qui ne couvre QUE la moitié : averti sur l’autre, et sur elle seule', async () => {
  // La forme la plus insidieuse du faux négatif : le fichier existe ET déclare quelque chose de
  // juste. Un contrôle qui se tait sur « il y a un .env » laisse partir un orchestrateur amputé
  // de son second serveur — sans un mot.
  const urlVar = variableDansUrl();
  const autre = RECLAMEES.find((v) => v !== urlVar);
  const depot = depotJetable();
  writeFileSync(join(depot, '.env'), `${autre}=factice\n`);

  const r = await avecEnvironnement(AUCUNE(), () => poser(depot));

  assert.equal(r.avertissements.length, 1, 'un .env à moitié suffisant a été pris pour un accès au registre complet');
  assert.match(r.avertissements[0], new RegExp(urlVar));
  assert.ok(!r.avertissements[0].includes(autre), `« ${autre} » est déclarée dans le .env et pourtant nommée manquante`);
});

test('CRITÈRE 5 — vide dans l’environnement, vide dans le .env : manquante dans les deux cas', async () => {
  const depotA = depotJetable();
  const rA = await avecEnvironnement(Object.fromEntries(RECLAMEES.map((v) => [v, ''])), () => poser(depotA));
  assert.equal(rA.avertissements.length, 1, 'des variables VIDES dans l’environnement ont été prises pour fournies');
  for (const v of RECLAMEES) assert.match(rA.avertissements[0], new RegExp(v));

  const depotB = depotJetable();
  writeFileSync(join(depotB, '.env'), RECLAMEES.map((v) => `${v}=`).join('\n') + '\n');
  const rB = await avecEnvironnement(AUCUNE(), () => poser(depotB));
  assert.equal(rB.avertissements.length, 1, 'des déclarations VIDES dans un .env ont été prises pour fournies');
});

test('les deux sources se COMPLÈTENT : une par le .env, l’autre par le processus — rien à signaler', async () => {
  // Le cas normal d'un poste qui a `claude-swt` (processus) sur un dépôt qui déclare son propre
  // jeton (fichier). La question n'est jamais « laquelle des deux sources », mais « est-ce
  // résolu ». Un contrôle qui exigerait UNE seule source refuserait ce montage parfaitement sain.
  const urlVar = variableDansUrl();
  const autre = RECLAMEES.find((v) => v !== urlVar);
  const depot = depotJetable();
  writeFileSync(join(depot, '.env'), `${autre}=factice\n`);

  const r = await avecEnvironnement({ [urlVar]: 'factice', [autre]: undefined }, () => poser(depot));
  assert.deepEqual(r.avertissements, [], 'le processus et le fichier doivent pouvoir se compléter');
});

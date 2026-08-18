// LA GARDE DE FRAÎCHEUR — un lieu ne se pose que sur le métier du pack de ce poste
// (T-20260818-0111, T-20260818-0113 · epic E-20260818-0014).
//
// LE DÉFAUT REPRODUIT ICI, ET C'EST LUI QUI A ÉTÉ ROUGE EN PREMIER : un dépôt qui porte un
// gabarit divergent — mesuré chez un client réel, un pack `v1.48.0` jamais mis à jour — se
// faisait poser un lieu, et la commande rendait `ok:true`. Le premier test de ce fichier
// échouait sur `assert.equal(r.ok, false)` avant que la garde n'existe.
//
// ⚠️ CHAQUE TEST DE REFUS S'ASSERTE SUR LE DISQUE, jamais sur le texte du message — la règle
// du dépôt : « une garde qui refuse doit être prouvée par ce qu'elle EMPÊCHE ». Un refus qui
// arriverait APRÈS l'écriture passerait un test qui ne lirait que la réponse.
//
// ⚠️ ET LE SECOND CHIFFRE EST ICI AUSSI. Une garde ne se juge pas sur ses seules prises : la
// section 3 éprouve ce qu'elle laisse passer — référence introuvable, référence illisible,
// gabarit à jour — parce que c'est par le faux refus qu'une garde utile se fait retirer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparerLieu, GABARITS } from '../src/lieu-agent.js';
import { empreinteGabarit, verifierFraicheur, referenceDuPoste, SOUS_CHEMIN_REFERENCE, COMMANDE_DE_RATTRAPAGE } from '../src/fraicheur-gabarit.js';
import { role as roleDe, rolesConnus } from '../src/roles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const GABARITS_SRC = join(REPO, '.claude', 'templates');

const OUVRABLE = async () => ({ joignable: true });
/** La versionnabilité n'est pas le sujet de ce fichier : on la neutralise explicitement. */
const VERSIONNABLE = async () => ({ connue: true, exclus: [] });

/**
 * UN POSTE JETABLE — un faux répertoire personnel dont le marketplace porte les gabarits
 * qu'on lui donne. C'est ce qui rend cette suite indépendante de l'état du poste qui
 * l'exécute : elle ne demande ni que le marketplace soit là, ni qu'il soit à jour.
 */
function posteJetable({ gabaritsDepuis = GABARITS_SRC } = {}) {
  const foyer = mkdtempSync(join(tmpdir(), 'ld-poste-'));
  cpSync(gabaritsDepuis, join(foyer, SOUS_CHEMIN_REFERENCE), { recursive: true });
  return foyer;
}

/** Un dépôt jetable qui a « reçu le pack » — les gabarits copiés depuis une source donnée. */
function depotJetable({ roles = ['orchestrateur'], depuis = GABARITS_SRC } = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'ld-fraich-'));
  for (const r of roles) {
    cpSync(join(depuis, roleDe(r).gabarits), join(racine, '.claude', 'templates', roleDe(r).gabarits), { recursive: true });
  }
  return racine;
}

/** Rend le gabarit d'un dépôt DIVERGENT — le cas client réel, un pack d'une autre époque. */
function perimer(depot, role, { fichier = 'CLAUDE.md', texte = '# Tu es le pilote d’un chantier.\n' } = {}) {
  writeFileSync(join(depot, '.claude', 'templates', roleDe(role).gabarits, fichier), texte);
}

const pose = (depot, role, nom, foyer, extra = {}) =>
  preparerLieu({ depot, role, nom, verifierLigne: OUVRABLE, verifierVersionnable: VERSIONNABLE, foyer, ...extra });

// ═════════════════════════════ 1. CE QU'ELLE ATTRAPE — et rien n'est créé

test('refus : le gabarit du dépôt diverge du pack de ce poste — RIEN n’a été créé (prouvé par le disque)', async () => {
  for (const role of rolesConnus()) {
    const foyer = posteJetable();
    const depot = depotJetable({ roles: [role] });
    perimer(depot, role);

    const r = await pose(depot, role, 'd-20260818-0008', foyer);

    assert.equal(r.ok, false, `${role} : la pose a abouti sur un gabarit divergent`);
    assert.equal(r.refus.motif, 'gabarit_perime', `${role} : motif rendu = ${r.refus.motif}`);
    // L'ASSERTION QUI COMPTE : le dossier du rôle ne doit pas même exister.
    assert.equal(
      existsSync(join(depot, roleDe(role).dossier)), false,
      `${role} : un lieu a été posé alors que la garde refusait`,
    );
  }
});

test('le refus PORTE LES DEUX EMPREINTES et les deux chemins — on dit ce qu’on a mesuré', async () => {
  const foyer = posteJetable();
  const depot = depotJetable();
  perimer(depot, 'orchestrateur');

  const r = await pose(depot, 'orchestrateur', 'd-1', foyer);

  const attenduDepot = empreinteGabarit(join(depot, '.claude', 'templates', 'orchestrateur'));
  const attenduRef = empreinteGabarit(join(foyer, SOUS_CHEMIN_REFERENCE, 'orchestrateur'));
  assert.ok(attenduDepot && attenduRef && attenduDepot !== attenduRef, 'précondition : les deux empreintes diffèrent');

  // Les champs STRUCTURÉS d'abord — c'est par eux qu'un appelant décide, pas par le texte.
  assert.equal(r.refus.empreinte_depot, attenduDepot);
  assert.equal(r.refus.empreinte_reference, attenduRef);
  assert.equal(r.refus.chemin_depot, join(depot, '.claude', 'templates', 'orchestrateur'));
  assert.equal(r.refus.chemin_reference, join(foyer, SOUS_CHEMIN_REFERENCE, 'orchestrateur'));

  // Puis le message, parce que c'est LUI que l'opérateur lit avant d'agir. Les empreintes
  // entières, pas tronquées : une empreinte coupée ne se recoupe pas avec un `shasum`.
  assert.ok(r.refus.message.includes(attenduDepot), 'le message ne porte pas l’empreinte du dépôt');
  assert.ok(r.refus.message.includes(attenduRef), 'le message ne porte pas l’empreinte de la référence');
  assert.ok(r.refus.message.includes(COMMANDE_DE_RATTRAPAGE), 'le message ne nomme pas la commande de rattrapage');
});

test('AUCUNE COMMANDE DESTRUCTRICE dans la bouche de la garde — ni dans son message, ni dans son texte', async () => {
  const foyer = posteJetable();
  const depot = depotJetable();
  perimer(depot, 'orchestrateur');
  const r = await pose(depot, 'orchestrateur', 'd-1', foyer);

  // Le vocabulaire qui a valu la règle (T-20260811-0087) : ce qui efface, ce qui force.
  const DESTRUCTEURS = [/\brm\b/, /\brmdir\b/, /--force/, /\bgit\s+reset\b/, /\bgit\s+clean\b/, /--hard/, /\bDROP\b/];
  for (const motif of DESTRUCTEURS) {
    assert.ok(!motif.test(r.refus.message), `le message de refus porte « ${motif} »`);
  }
  const source = readFileSync(join(REPO, 'ligne-directe', 'src', 'fraicheur-gabarit.js'), 'utf8');
  const messages = source.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const motif of DESTRUCTEURS) {
    assert.ok(!motif.test(messages), `la garde peut mettre « ${motif} » dans la bouche de quelqu’un`);
  }
});

test('un SEUL fichier du gabarit qui diverge suffit — y compris les dotfiles, qui portent les droits', async () => {
  // T-20260818-0034 : un lieu rafraîchi était DÉSARMÉ parce que `.claude/settings.json` avait
  // changé, et rien ne le disait. Une empreinte qui ne regarderait que `CLAUDE.md` rejouerait
  // ce défaut sous la garde même qui prétend le fermer.
  for (const fichier of GABARITS) {
    const foyer = posteJetable();
    const depot = depotJetable();
    perimer(depot, 'orchestrateur', { fichier, texte: '{"divergence": true}\n' });

    const r = await pose(depot, 'orchestrateur', 'd-1', foyer);
    assert.equal(r.ok, false, `« ${fichier} » modifié : la pose est passée`);
    assert.equal(r.refus.motif, 'gabarit_perime', `« ${fichier} » modifié : motif ${r.refus.motif}`);
    assert.equal(existsSync(join(depot, '.orchestrateur')), false, `« ${fichier} » modifié : un lieu a été créé`);
  }
});

test('un fichier RETIRÉ du gabarit du dépôt est vu — l’empreinte porte les chemins, pas seulement les contenus', async () => {
  // La garde de la SOURCE (gabarits_absents) attrape les quatre fichiers qu'elle connaît ;
  // celle-ci doit attraper un cinquième fichier ajouté demain au gabarit et absent du dépôt.
  const foyer = posteJetable();
  const depot = depotJetable();
  writeFileSync(join(foyer, SOUS_CHEMIN_REFERENCE, 'orchestrateur', 'AMORCE.md'), '# un cinquième fichier\n');

  const r = await pose(depot, 'orchestrateur', 'd-1', foyer);
  assert.equal(r.ok, false, 'un fichier présent au pack et absent du dépôt est passé inaperçu');
  assert.equal(r.refus.motif, 'gabarit_perime');
  assert.equal(existsSync(join(depot, '.orchestrateur')), false);
});

// ═════════════════════════════ 2. CE QU'ELLE LAISSE PASSER — le second chiffre

test('un dépôt À JOUR passe, et la pose DIT qu’elle a vérifié', async () => {
  for (const role of rolesConnus()) {
    const foyer = posteJetable();
    const depot = depotJetable({ roles: [role] });

    const r = await pose(depot, role, 'a-jour', foyer);

    assert.equal(r.ok, true, `${role} : un dépôt à jour a été refusé — c’est un faux refus`);
    assert.equal(r.metier_verifie, true, `${role} : la pose n’a pas dit qu’elle avait vérifié`);
    assert.equal(existsSync(join(depot, roleDe(role).dossier, 'a-jour', 'CLAUDE.md')), true);
  }
});

test('RÉFÉRENCE INTROUVABLE : la pose RÉUSSIT et le dit — jamais un refus', async () => {
  // Le piège nommé par la conception : un poste neuf, qui n’a jamais ajouté le marketplace.
  // Une garde qui refuserait là serait retirée, en emportant ce qu’elle gardait vraiment.
  const foyerNu = mkdtempSync(join(tmpdir(), 'ld-poste-nu-'));
  const depot = depotJetable();
  perimer(depot, 'orchestrateur'); // ET le gabarit diverge : ça ne change RIEN sans référence

  const r = await pose(depot, 'orchestrateur', 'sans-reference', foyerNu);

  assert.equal(r.ok, true, 'une référence introuvable a fait refuser la pose — la garde crie à tort');
  assert.equal(r.metier_verifie, false, 'la pose a prétendu avoir vérifié ce qu’elle n’a pas mesuré');
  assert.ok(
    typeof r.metier_non_verifie === 'string' && r.metier_non_verifie.length > 20,
    'la pose n’a pas DIT pourquoi elle n’a pas pu vérifier',
  );
  assert.equal(existsSync(join(depot, '.orchestrateur', 'sans-reference', 'CLAUDE.md')), true, 'le lieu n’a pas été posé');
});

test('RÉFÉRENCE PRÉSENTE MAIS ILLISIBLE : elle ne refuse pas non plus — on ne conclut rien d’une mesure ratée', async (t) => {
  const foyer = posteJetable();
  const refDir = join(foyer, SOUS_CHEMIN_REFERENCE, 'orchestrateur');
  // Un répertoire qu'on ne peut pas parcourir. `chmod 000` est sans effet quand le processus
  // est root (conteneurs CI) : on le constate et on saute plutôt que de rendre un faux vert.
  chmodSync(refDir, 0o000);
  t.after(() => { try { chmodSync(refDir, 0o755); } catch { /* déjà rendu */ } });
  let lisible = true;
  try { readFileSync(join(refDir, 'CLAUDE.md')); } catch { lisible = false; }
  if (lisible) return t.skip('ce processus lit malgré chmod 000 (root ?) — cas non éprouvable ici');

  const depot = depotJetable();
  perimer(depot, 'orchestrateur');
  const r = await pose(depot, 'orchestrateur', 'ref-illisible', foyer);

  assert.equal(r.ok, true, 'une référence illisible a fait refuser — « je n’ai pas pu regarder » a été lu comme « ils diffèrent »');
  assert.equal(r.metier_verifie, false);
  assert.equal(existsSync(join(depot, '.orchestrateur', 'ref-illisible', 'CLAUDE.md')), true);
});

test('LE RÉSIDU DE LA MISE À JOUR NE FAIT PAS REFUSER — sinon la garde mord la main qui la répare', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // MESURÉ SUR LE PARC RÉEL, 2026-08-18, et ce cas aurait fait échouer la garde en production.
  //
  // La convergence du pack dépose une sauvegarde `<fichier>.somtech.bak` à côté de ce qu'elle
  // remplace. Constaté : `actionprogex/orchestrateur` et `sibelanger/orchestrateur` portent un
  // gabarit au contenu RÉELLEMENT IDENTIQUE et rendaient deux empreintes différentes — le
  // second traîne un `CLAUDE.md.somtech.bak`.
  //
  // Conséquence si on les comptait : le message de refus recommande « pack update » ; « pack
  // update » dépose le résidu ; le résidu reconduit le refus. Le geste de rattrapage n'aurait
  // JAMAIS convergé, et la garde aurait paru attraper un dépôt qu'elle venait de faire réparer.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const foyer = posteJetable();
  const depot = depotJetable();
  const gabaritDepot = join(depot, '.claude', 'templates', 'orchestrateur');
  for (const residu of ['CLAUDE.md.somtech.bak', 'CLAUDE.md.somtech.bak.1', '.claude/settings.json.somtech.bak']) {
    writeFileSync(join(gabaritDepot, residu), 'un état antérieur, gardé de côté par la convergence');
  }

  const r = await pose(depot, 'orchestrateur', 'apres-mise-a-jour', foyer);

  assert.equal(r.ok, true, 'un dépôt à jour a été refusé À CAUSE du résidu de sa propre mise à jour');
  assert.equal(r.metier_verifie, true);
  assert.equal(existsSync(join(depot, '.orchestrateur', 'apres-mise-a-jour', 'CLAUDE.md')), true);

  // Et le témoin qui empêche ce test d'être vert pour la mauvaise raison : un vrai écart de
  // contenu, dans le même dépôt, doit continuer de refuser.
  perimer(depot, 'orchestrateur');
  const encore = await pose(depot, 'orchestrateur', 'autre-nom', foyer);
  assert.equal(encore.refus?.motif, 'gabarit_perime', 'l’exclusion des résidus a rendu la garde aveugle au contenu');
});

test('LE DÉPÔT-SOURCE DU PACK n’est pas comparé à lui-même — et il le dit', async () => {
  // Le second faux refus certain : `somtech-pack` est l'endroit où les gabarits SE MODIFIENT.
  // Dès qu'une branche y touche, son arbre diverge du pack installé — c'est le travail en
  // cours, pas une péremption. (Mesuré : le checkout de travail du dépôt-source figurait
  // parmi les six « refusés » du parc, pour cette seule raison.)
  const foyer = posteJetable();
  const depot = depotJetable();
  perimer(depot, 'orchestrateur');
  writeFileSync(join(depot, 'pack.json'), JSON.stringify({ name: 'somtech-pack', modules: {} }));

  const r = await pose(depot, 'orchestrateur', 'dans-la-source', foyer);

  assert.equal(r.ok, true, 'le dépôt-source du pack a été refusé sur son propre gabarit en cours de travail');
  assert.equal(r.metier_verifie, false, 'l’exemption s’est prise en silence — elle doit se dire');
  assert.ok(/source du pack/i.test(r.metier_non_verifie), `la raison ne nomme pas l’exemption : ${r.metier_non_verifie}`);

  // ⚠️ ET LA PORTE NE S'OUVRE PAS À N'IMPORTE QUI. Un dépôt servi ne porte pas ce manifeste
  // (mesuré sur le parc) ; un `pack.json` d'un AUTRE paquet ne doit rien exempter du tout.
  for (const contenu of ['{"name":"autre-chose"}', '{}', 'pas du json', '']) {
    const autre = depotJetable();
    perimer(autre, 'orchestrateur');
    writeFileSync(join(autre, 'pack.json'), contenu);
    const refuse = await pose(autre, 'orchestrateur', 'd-1', foyer);
    assert.equal(refuse.ok, false, `« ${contenu.slice(0, 20)} » a désarmé la garde`);
    assert.equal(refuse.refus.motif, 'gabarit_perime');
  }
});

test('un lieu DÉJÀ POSÉ reste idempotent — la garde ne transforme pas un no-op en refus', async () => {
  const foyer = posteJetable();
  const depot = depotJetable();
  const premier = await pose(depot, 'orchestrateur', 'deja', foyer);
  assert.equal(premier.ok, true);

  // Le pack du dépôt devient périmé APRÈS coup — cas réel : le lieu est là, le pack a vieilli.
  perimer(depot, 'orchestrateur');
  const second = await pose(depot, 'orchestrateur', 'deja', foyer);

  assert.equal(second.ok, true, 'une relance sur un lieu déjà posé a été refusée alors que rien n’était à servir');
  assert.equal(second.deja_installe, true);
  assert.equal(second.cree, false);
});

// ═════════════════════════════ 3. L'ORDRE DES GARDES — la fraîcheur ne coiffe pas l'absence

test('un dépôt SANS gabarit rend « gabarits_absents », pas « gabarit_perime » — deux causes, deux gestes', async () => {
  // Confondre les deux enverrait mettre à jour un pack qui n’a jamais été installé.
  const foyer = posteJetable();
  const depotNu = mkdtempSync(join(tmpdir(), 'ld-nu-'));
  const r = await pose(depotNu, 'orchestrateur', 'd-1', foyer);

  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'gabarits_absents');
  assert.equal(existsSync(join(depotNu, '.orchestrateur')), false);
});

test('la fraîcheur tombe AVANT la ligne — un refus local ne coûte aucun aller-retour réseau', async () => {
  const foyer = posteJetable();
  const depot = depotJetable();
  perimer(depot, 'orchestrateur');
  let sollicitee = false;

  const r = await preparerLieu({
    depot, role: 'orchestrateur', nom: 'd-1', foyer,
    verifierVersionnable: VERSIONNABLE,
    verifierLigne: async () => { sollicitee = true; return { joignable: true }; },
  });

  assert.equal(r.refus.motif, 'gabarit_perime');
  assert.equal(sollicitee, false, 'la ligne a été sollicitée alors que le gabarit était déjà jugé périmé');
});

// ═════════════════════════════ 4. LA GARDE EST ARMÉE PAR DÉFAUT

test('AUCUN APPELANT DE PRODUCTION ne passe « foyer » — la résolution réelle est celle qui s’exerce', () => {
  // Sans ce test, l'injection qui rend la garde éprouvable serait aussi ce qui la désarme :
  // il suffirait d'un `foyer: undefined` glissé dans un appelant pour que plus rien ne morde,
  // et aucune suite ne rougirait. On borne donc l'injection aux tests, par le fait.
  const PRODUCTION = [
    join(REPO, 'ligne-directe', 'src', 'orchestrateur.js'),
    join(REPO, 'ligne-directe', 'src', 'representant.js'),
    join(REPO, 'ligne-directe', 'bin', 'ligne-directe.js'),
    join(REPO, 'ligne-directe', 'src', 'lieu-expose.js'),
  ];
  for (const f of PRODUCTION) {
    if (!existsSync(f)) continue;
    const sansCommentaires = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.ok(
      !/\bfoyer\b/.test(sansCommentaires),
      `${f} passe « foyer » — l’injection de test a fui en production, et la garde y est désarmable`,
    );
  }
});

test('la résolution PAR DÉFAUT vise bien le pack du poste — vérifiée en la faisant travailler', () => {
  // Un test qui ne ferait que lire la constante prouverait qu'une chaîne existe. Celui-ci
  // fait résoudre la fonction contre un faux foyer réellement peuplé, puis contre un foyer nu.
  const foyer = posteJetable();
  const trouvee = referenceDuPoste('orchestrateur', { foyer });
  assert.equal(trouvee.chemin, join(foyer, SOUS_CHEMIN_REFERENCE, 'orchestrateur'));

  const nu = referenceDuPoste('orchestrateur', { foyer: mkdtempSync(join(tmpdir(), 'ld-nu-')) });
  assert.equal(nu.chemin, null);
  assert.ok(nu.raison.includes('marketplaces'), 'la raison ne nomme pas le chemin cherché — l’opérateur ne saurait pas où regarder');

  // Et sans foyer donné du tout : elle interroge le répertoire personnel du processus. On ne
  // s'asserte pas sur le résultat (il dépend du poste), on s'asserte sur ce qu'elle CONSULTE.
  const avant = process.env.HOME;
  try {
    process.env.HOME = foyer;
    assert.equal(referenceDuPoste('orchestrateur').chemin, join(foyer, SOUS_CHEMIN_REFERENCE, 'orchestrateur'));
  } finally {
    if (avant === undefined) delete process.env.HOME; else process.env.HOME = avant;
  }
});

// ═════════════════════════════ 5. LA MESURE ELLE-MÊME

test('l’empreinte distingue ce qu’elle doit distinguer, et confond ce qu’elle doit confondre', () => {
  const a = mkdtempSync(join(tmpdir(), 'emp-a-'));
  const b = mkdtempSync(join(tmpdir(), 'emp-b-'));
  cpSync(join(GABARITS_SRC, 'orchestrateur'), a, { recursive: true });
  cpSync(join(GABARITS_SRC, 'orchestrateur'), b, { recursive: true });

  assert.equal(empreinteGabarit(a), empreinteGabarit(b), 'deux copies identiques rendent des empreintes différentes');

  // CE QUI N'APPARTIENT À AUCUN PACK NE COMPTE PAS — et les deux motifs ont été mesurés.
  for (const bruit of ['.DS_Store', 'CLAUDE.md.somtech.bak', 'CLAUDE.md.somtech.bak.1', '.claude/settings.json.somtech.bak']) {
    writeFileSync(join(b, bruit), 'ni distribué par le pack, ni écrit par lui comme gabarit');
    assert.equal(empreinteGabarit(a), empreinteGabarit(b), `« ${bruit} » a été compté dans l’empreinte`);
  }

  // Un octet dans un dotfile imbriqué, lui, compte.
  writeFileSync(join(b, '.claude', 'settings.json'), '{}');
  assert.notEqual(empreinteGabarit(a), empreinteGabarit(b), 'un dotfile imbriqué modifié n’a pas changé l’empreinte');

  // Absent, vide, illisible → `null`, JAMAIS une empreinte comparable.
  assert.equal(empreinteGabarit(join(a, 'nexiste-pas')), null);
  assert.equal(empreinteGabarit(mkdtempSync(join(tmpdir(), 'emp-vide-'))), null, 'un répertoire vide a rendu une empreinte');
  assert.equal(empreinteGabarit(join(a, 'CLAUDE.md')), null, 'un fichier (non répertoire) a rendu une empreinte');
});

test('le verdict de la garde a exactement trois formes — et « je n’ai pas su » n’est jamais « ils diffèrent »', () => {
  const foyer = posteJetable();
  const depot = depotJetable();
  const gabaritDepot = join(depot, '.claude', 'templates', 'orchestrateur');

  const identique = verifierFraicheur({ gabaritDepot, gabarit: 'orchestrateur', foyer });
  assert.deepEqual(
    { verifie: identique.verifie, perime: identique.perime },
    { verifie: true, perime: undefined },
  );

  perimer(depot, 'orchestrateur');
  const divergent = verifierFraicheur({ gabaritDepot, gabarit: 'orchestrateur', libelle: 'orchestrateur', foyer });
  assert.equal(divergent.verifie, false);
  assert.equal(divergent.perime, true);

  const sansRef = verifierFraicheur({ gabaritDepot, gabarit: 'orchestrateur', foyer: mkdtempSync(join(tmpdir(), 'nu-')) });
  assert.equal(sansRef.verifie, false);
  assert.notEqual(sansRef.perime, true, '« pas su mesurer » a été rendu comme un péremption — la garde crierait à tort');
  assert.ok(sansRef.raison, 'une mesure impossible sans raison dite ne se distingue pas d’un succès');
});

test('la garde ne dépend que de « node: » — c’est ce qui rend son miroir côté CLI possible', () => {
  const src = readFileSync(join(REPO, 'ligne-directe', 'src', 'fraicheur-gabarit.js'), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  const etrangers = imports.filter((i) => !i.startsWith('node:'));
  assert.deepEqual(etrangers, [], `fraicheur-gabarit.js importe ${etrangers.join(', ')} — la copie côté CLI tomberait chez le client`);
});

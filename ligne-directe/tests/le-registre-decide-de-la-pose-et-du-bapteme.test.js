// le-registre-decide-de-la-pose-et-du-bapteme.test.js — DEUX DÉCISIONS QUI VIVAIENT AILLEURS
// QUE DANS LE REGISTRE (T-20260826-0076, points 1 et 2).
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUI A ÉTÉ MESURÉ, ET OÙ
//
//   • `naissance-representant/bin/naitre.js:272` — `if (role !== 'orchestrateur')`. La pose
//     d'un lieu absent n'existait QUE pour l'orchestrateur ; tout autre rôle du registre
//     sortait en `exit(1)`. Le cœur de la pose n'était pourtant PAS en dur : `preparerLieu`
//     (`lieu-agent.js:532`) prend le rôle en argument depuis toujours, et
//     `preparerLieuOrchestrateur` n'en est qu'une enveloppe de deux lignes.
//   • `ligne-directe/src/nom-de-riviere.js:302` — `if (role !== 'orchestrateur')`. Le baptême
//     par nom de rivière était réservé en dur ; tout autre rôle était nommé par son code.
//
// Le registre porte déjà l'en-tête qui condamne ces deux lignes : « Ajouter un rôle, c'est
// ajouter une ligne — jamais un module ». Ces deux comparaisons littérales faisaient de
// l'ajout d'un rôle un travail de MODULE : il fallait aller éditer deux fichiers qui ne
// parlent pas des rôles pour qu'un rôle neuf puisse naître.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ CE QUE CES ESSAIS GARDENT VRAIMENT — ET C'EST L'AUTRE MOITIÉ, LA PLUS DURABLE.
//
// Fermer les deux littéraux d'aujourd'hui ne garde rien de ce qu'on ajoutera demain. Le
// chantier en cours (P-20260819-0001) porte NEUF rôles : le premier d'entre eux inscrit sans
// dire comment il se pose ni comment il se nomme retomberait, en silence, sur un repli que
// personne n'a choisi pour lui. Ces essais PARCOURENT donc le registre — jamais une liste
// recopiée — et exigent de CHAQUE rôle qu'il déclare les deux. Un rôle ajouté sans elles fait
// rougir ce fichier avant d'atteindre un poste.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { role as roleDe, rolesConnus, rolesSansLieu, roleSansLieu, clesBrutesDesRolesSansLieu, tableSansLieuVerrouillee, poseAutomatique, poseManuelle, baptemeDuRole, RoleInconnu } from '../src/roles.js';
import { nomDeLAgentQuiNait, estUneRiviere } from '../src/nom-de-riviere.js';

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — LE REGISTRE DIT LES DEUX CHOSES, POUR CHAQUE RÔLE

test('CHAQUE rôle du registre dit si sa pose est automatique — sinon la décision vit ailleurs', () => {
  const muets = rolesConnus().filter((nom) => typeof roleDe(nom).pose_automatique !== 'boolean');
  assert.deepEqual(
    muets,
    [],
    'ces rôles ne disent pas si « naitre » peut poser leur lieu d’autorité : ' +
      `${muets.join(', ')}. Tant qu’ils se taisent, la décision se prend hors du registre — ` +
      'c’était la comparaison littérale « role !== \'orchestrateur\' » de naitre.js:272.',
  );
});

test('CHAQUE rôle du registre dit comment il est NOMMÉ à sa naissance', () => {
  const permis = ['riviere', 'code'];
  const muets = rolesConnus().filter((nom) => !permis.includes(roleDe(nom).bapteme));
  assert.deepEqual(
    muets,
    [],
    'ces rôles ne disent pas comment ils sont baptisés (« riviere » ou « code ») : ' +
      `${muets.join(', ')}. C’était la comparaison littérale de nom-de-riviere.js:302.`,
  );
});

// ⚠️ UN « false » N'EST PAS UNE PARESSE — ET SA RAISON DOIT VIVRE AU REGISTRE, PAS DANS UN
// COMMENTAIRE DE `naitre.js`. Le représentant garde sa pose manuelle pour un motif tranché par
// le dirigeant le 2026-08-16 ; si ce motif et le geste qui lève le blocage restent en dur dans
// la commande, on a DÉPLACÉ le littéral au lieu de l'enlever.
test('UN RÔLE QUI REFUSE LA POSE AUTOMATIQUE DIT POURQUOI, ET OÙ ALLER', () => {
  const manuels = rolesConnus().filter((nom) => roleDe(nom).pose_automatique === false);
  assert.ok(manuels.length > 0, 'le registre doit porter au moins un rôle à pose manuelle — sinon cet essai ne garde rien');

  for (const nom of manuels) {
    const dit = roleDe(nom).pose_manuelle;
    assert.ok(dit, `« ${nom} » refuse la pose automatique sans dire pourquoi`);
    assert.ok(
      typeof dit.motif === 'string' && dit.motif.trim().length > 20,
      `« ${nom} » doit NOMMER ce qui garde sa revue — sinon son refus passe pour un caprice (lu : ${JSON.stringify(dit.motif)})`,
    );
    assert.ok(
      typeof dit.geste === 'string' && dit.geste.trim().length > 10,
      `« ${nom} » doit dire OÙ ALLER quand sa pose est refusée — un refus sans geste laisse l’opérateur sur place (lu : ${JSON.stringify(dit.geste)})`,
    );
  }
});

// ⚠️ LES VALEURS D'AUJOURD'HUI SONT ÉPINGLÉES. Sans ça, les trois essais ci-dessus resteraient
// verts si quelqu'un mettait `pose_automatique: true` au représentant — c'est-à-dire si on
// posait d'autorité un lieu branché sur un canal que le client voit, la seule frontière que le
// dirigeant a demandé de ne pas franchir (2026-08-16).
test('LES VALEURS MESURÉES DES DEUX RÔLES EXISTANTS SONT ÉPINGLÉES', () => {
  assert.equal(roleDe('orchestrateur').pose_automatique, true, 'l’orchestrateur naît sans qu’un humain touche un écran');
  assert.equal(roleDe('orchestrateur').bapteme, 'riviere', 'il vit longtemps et porte plusieurs mandats : une rivière');
  assert.equal(roleDe('representant').pose_automatique, false, 'sa pose garde sa revue — arbitrage du dirigeant, 2026-08-16');
  assert.equal(roleDe('representant').bapteme, 'code', 'il porte le prénom de la personne qu’il représente');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — LES REPLIS SONT AU REGISTRE, EN UN SEUL ENDROIT
//
// Même raison que `lignesDuRole` : un `?? false` oublié chez un lecteur rendrait un rôle SANS
// repli, et le repli qui compte ici décide de poser ou non un lieu d'autorité.

test('UN RÔLE QUI NE DIT RIEN NE SE FAIT PAS POSER D’AUTORITÉ — le repli penche du côté qui n’écrit pas', () => {
  // La question se pose sur un rôle réel — le registre refuse de décider sur un inconnu.
  assert.equal(poseAutomatique('orchestrateur'), true);
  assert.equal(poseAutomatique('representant'), false);
});

test('LE REPLI DE `poseManuelle` NE FABRIQUE AUCUN GESTE — il dit qu’il n’en a pas', () => {
  const dit = poseManuelle('representant');
  assert.match(dit.geste, /gestionnaire-client/, 'le geste réel vient du registre');
  assert.match(dit.motif, /canal/i, 'et le motif aussi');
});

// ⚠️ LES DEUX REPLIS SONT ÉPROUVÉS, PAS SEULEMENT ÉCRITS. Aucun rôle déclaré ne les atteint —
// un essai plus haut s'en assure — donc sans ceci ils seraient du code jamais exécuté, dont on
// ne saurait qu'au neuvième rôle s'il tient ce que son commentaire promet. On retire la
// déclaration en mémoire, dans ce seul processus, et on la remet.
test('UN RÔLE QUI OUBLIE `pose_automatique` NE SE FAIT PAS POSER — le repli est éprouvé, pas supposé', () => {
  const r = roleDe('orchestrateur');
  const declare = r.pose_automatique;
  try {
    delete r.pose_automatique;
    assert.equal(poseAutomatique('orchestrateur'), false, 'clé absente : le repli doit refuser, pas poser');
    r.pose_automatique = 'oui'; // une valeur qui a l'air d'un « vrai » sans en être un
    assert.equal(poseAutomatique('orchestrateur'), false, 'seul un `true` explicite autorise une écriture sur le disque');
  } finally {
    r.pose_automatique = declare;
  }
  assert.equal(poseAutomatique('orchestrateur'), true, 'la déclaration est remise telle qu’elle était');
});

test('UN RÔLE QUI OUBLIE `pose_manuelle` REÇOIT UN REPLI QUI N’INVENTE RIEN', () => {
  const r = roleDe('representant');
  const declare = r.pose_manuelle;
  try {
    delete r.pose_manuelle;
    const dit = poseManuelle('representant');
    assert.ok(!/gestionnaire-client/.test(dit.geste), 'le repli ne sert PAS le geste d’un autre rôle');
    assert.match(dit.geste, /roles\.js/, 'il nomme le fichier où le geste manquant s’inscrit');
    assert.match(dit.motif, /ne dit pas/, 'et le motif dit qu’on ne sait pas, plutôt que d’en inventer un');
  } finally {
    r.pose_manuelle = declare;
  }
  assert.match(poseManuelle('representant').geste, /gestionnaire-client/, 'la déclaration est remise telle qu’elle était');
});

test('`baptemeDuRole` rend ce que le registre déclare', () => {
  assert.equal(baptemeDuRole('orchestrateur'), 'riviere');
  assert.equal(baptemeDuRole('representant'), 'code');
});

test('LES TROIS ACCESSEURS REFUSENT DE DÉCIDER SUR UN RÔLE INCONNU', () => {
  // Le registre l'écrit déjà : « DÉCIDER sur un rôle qu'on ne connaît pas reste interdit ».
  // Ces trois-là décident — deux d'entre eux décident d'écrire sur le disque.
  for (const accesseur of [poseAutomatique, poseManuelle, baptemeDuRole]) {
    assert.throws(() => accesseur('cuisinier'), RoleInconnu, `${accesseur.name} a décidé sur un rôle inconnu`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — LE BAPTÊME SUIT LE REGISTRE, POUR CHAQUE RÔLE

let bacs = [];
const bacNeuf = () => {
  const d = mkdtempSync(join(tmpdir(), 'smtk-bapteme-'));
  bacs.push(d);
  return d;
};
test.after(() => {
  for (const d of bacs) rmSync(d, { recursive: true, force: true });
  bacs = [];
});

test('LE BAPTÊME DE CHAQUE RÔLE EST CELUI QUE SON REGISTRE DÉCLARE — jamais celui d’un littéral', () => {
  for (const nom of rolesConnus()) {
    const attendu = roleDe(nom).bapteme;
    const r = nomDeLAgentQuiNait({
      role: nom,
      lieu: bacNeuf(), // un lieu vide : aucun `.nom-agent` inscrit, donc c'est le rôle qui tranche
      code: 'd-20260826-0001',
      // Le parc est VIDE et la mesure est complète : rien ne doit détourner le tirage.
      depot: bacNeuf(),
      listerAgents: () => [],
      lireRegistre: () => ({ lignes: {}, communs: {} }),
    });

    assert.ok(r.nom, `« ${nom} » n’a reçu aucun nom : ${r.message ?? ''}`);
    if (attendu === 'riviere') {
      assert.ok(
        estUneRiviere(r.nom),
        `« ${nom} » déclare le baptême par rivière et a reçu « ${r.nom} » (source : ${r.source})`,
      );
      assert.equal(r.attribue, true, `« ${nom} » déclare la rivière : elle doit être ATTRIBUÉE, pas subie`);
    } else {
      assert.equal(
        r.nom,
        'd-20260826-0001',
        `« ${nom} » déclare le baptême ${JSON.stringify(attendu)} et a reçu « ${r.nom} » (source : ${r.source})`,
      );
      assert.equal(r.attribue, false, `« ${nom} » déclare le code : rien n’est tiré du parc des rivières`);
    }
  }
});

// ⚠️ L'INSTRUMENT QUI DISCRIMINE VRAIMENT — ET IL EST LE SEUL, TANT QUE LE REGISTRE N'A QUE
// DEUX RÔLES.
//
// L'essai ci-dessus est VERT même sur le code d'avant le correctif : avec deux rôles dont un
// seul est l'orchestrateur, la comparaison littérale `role !== 'orchestrateur'` rend exactement
// ce que le registre déclare. Il ne prouve donc RIEN sur l'origine de la décision — il ne
// mordra qu'au troisième rôle. C'est un essai qui garde l'avenir, pas un essai qui a trouvé le
// défaut, et le dire ici évite de compter deux fois la même preuve.
//
// Ce qui discrimine, c'est de DÉPLACER LA DÉFINITION et de regarder si la décision suit. On
// change ce que le registre déclare, en mémoire, dans ce seul processus, et on le remet —
// `node --test` isole chaque fichier dans son processus, et le `finally` couvre l'échec.
// Sur le code d'avant, la décision ne bougeait pas : elle ne lisait pas le registre.
test('DÉPLACER LA DÉCLARATION DÉPLACE LA DÉCISION — c’est ce qui prouve que le littéral est parti', () => {
  const orchestrateur = roleDe('orchestrateur');
  const declare = orchestrateur.bapteme;
  try {
    orchestrateur.bapteme = 'code';
    const r = nomDeLAgentQuiNait({
      role: 'orchestrateur',
      lieu: bacNeuf(),
      code: 'd-20260826-0002',
      depot: bacNeuf(),
      listerAgents: () => [],
      lireRegistre: () => ({ lignes: {}, communs: {} }),
    });
    assert.equal(
      r.nom,
      'd-20260826-0002',
      `le registre déclare « code » et l’orchestrateur a reçu « ${r.nom} » : la décision ne vient pas du registre`,
    );
  } finally {
    orchestrateur.bapteme = declare;
  }
  assert.equal(roleDe('orchestrateur').bapteme, 'riviere', 'la déclaration est remise telle qu’elle était');
});

// ⚠️ ET LA MOITIÉ QUI PROTÈGE LES RIVIÈRES. Avant ce lot, un rôle qu'on ne connaît pas était
// nommé par son code EN SILENCE — la comparaison littérale rangeait « inconnu » avec
// « représentant ». Un rôle qui n'existe pas n'a pas de convention de nom : on ne lui en
// invente pas une, on refuse.
test('UN RÔLE INCONNU NE SE FAIT PLUS NOMMER EN SILENCE', () => {
  assert.throws(
    () => nomDeLAgentQuiNait({ role: 'cuisinier', lieu: bacNeuf(), code: 'peu-importe' }),
    RoleInconnu,
    'un rôle inconnu était rangé avec « pas orchestrateur » et repartait avec son code',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA SECONDE TABLE DU REGISTRE — `ROLES_SANS_LIEU`, ET QUI LA GARDE (2026-09-01)
//
// 🔴 CE QUE CES ESSAIS FERMENT, ET COMMENT LE TROU A ÉTÉ MESURÉ. `ROLES_SANS_LIEU` est née à
// la fusion de `E-20260825-0002` : un chef d'équipe est un rôle CONNU qui n'a pas de lieu, et
// qui ne peut pas entrer dans `ROLES` (une entrée sans `entetes` fait tomber
// `roleDuLieuOuRefus` sur `Object.entries(undefined)`). Elle décide de `baptemeDuRole` et
// nourrit l'aide en ligne : elle a donc L'AUTORITÉ d'une table du registre.
//
// ⚠️ ELLE N'EN AVAIT PAS LA GARDE, et les deux moitiés n'étaient PAS symétriques. Mesuré par
// mutation, contrôle négatif vert (0 · 0), les trois suites :
//
//   • RETIRER `chef-equipe` de la table   →  33 rouges. La table EST lue, elle EST vivante.
//   • AJOUTER un rôle bidon à la table    →   0 rouge. Personne ne regarde.
//   • AJOUTER le même rôle bidon à `ROLES` → 162 rouges. La PREMIÈRE table, elle, est gardée.
//
// Une seconde porte, la même autorité que la première, et aucune de sa garde. Le trou n'est
// pas « la table est fausse » : c'est que sa moitié « ce qu'on ne doit PAS y ajouter » n'était
// gardée par rien, à côté d'une moitié « ce qui doit y être » qui l'était.
//
// ⚠️ ET CE N'EST PAS UNE LISTE D'EXCEPTIONS QU'ON ÉLARGIT. Le troisième essai ci-dessous est
// celui qui mord vraiment : une entrée sans lieu n'a le droit de déclarer QUE `libelle` et
// `bapteme`. Elle ne peut donc pas se doter d'un `dossier` en douce et devenir un `ROLES`
// fantôme — le registre se mettrait à balayer des lieux qui n'existent pas. Épingler les noms
// se contourne en éditant l'épingle ; épingler la FORME oblige à dire ce qu'on veut faire.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('LA TABLE DES RÔLES SANS LIEU EST ÉPINGLÉE — l’y ajouter est un arbitrage, pas de l’entretien', () => {
  assert.deepEqual(
    rolesSansLieu().sort(), ['chef-equipe'],
    'un rôle a été ajouté ou retiré de `ROLES_SANS_LIEU` — cette table dit qui échappe à la ' +
      'table des lieux, et son contenu est une décision, pas une commodité de passage'
  );
});

test('AUCUN RÔLE N’EST DANS LES DEUX TABLES À LA FOIS — sinon la question « a-t-il un lieu ? » a deux réponses', () => {
  const deuxFois = rolesSansLieu().filter((nom) => rolesConnus().includes(nom));
  assert.deepEqual(
    deuxFois, [],
    `« ${deuxFois.join(', ')} » est déclaré dans ROLES et dans ROLES_SANS_LIEU — selon la ` +
      `fonction interrogée, il aurait un lieu ou n’en aurait pas, et rien ne dirait laquelle a raison`
  );
});

test('🔴 UNE ENTRÉE SANS LIEU NE DÉCLARE QUE `libelle` ET `bapteme` — elle ne devient pas un `ROLES` fantôme', () => {
  // Le champ qui compte est `dossier` : l'ajouter ici ferait balayer par le registre des lieux
  // qui n'existent pas. Mais on n'énumère pas les champs INTERDITS — une liste d'interdits
  // s'oublie au premier champ neuf. On énumère les champs PERMIS, et tout le reste tombe.
  const PERMIS = ['libelle', 'bapteme'];
  for (const nom of rolesSansLieu()) {
    const entree = roleSansLieu(nom);
    assert.ok(entree, `« ${nom} » est énuméré mais son entrée est introuvable`);
    // 🔴 `Reflect.ownKeys` ET PAS `Object.keys` — la garde était aveugle, et c'est mesuré.
    // `Object.defineProperty(entree, 'dossier', { enumerable: false })` posait un champ que
    // la production lit parfaitement (`entree.dossier`, `'dossier' in entree`) et que
    // `Object.keys` ne rendait pas : le « ROLES fantôme » que cet essai prétend interdire
    // passait sous lui, 0 rouge sur 2 085 essais. Une garde qui énumère doit énumérer comme
    // celui qui LIT, jamais comme celui qui DÉCLARE.
    const interdits = Reflect.ownKeys(entree).map(String).filter((c) => !PERMIS.includes(c));
    assert.deepEqual(
      interdits, [],
      `« ${nom} » déclare ${interdits.map((c) => `\`${c}\``).join(', ')} — un rôle SANS lieu qui ` +
        `porte les clés d'un rôle QUI EN A UN est la moitié d'une entrée de \`ROLES\`, et le ` +
        `registre la traitera comme telle sans que personne l'ait décidé`
    );
    assert.ok(
      typeof entree.libelle === 'string' && entree.libelle.length > 0,
      `« ${nom} » n'a pas de libellé lisible`
    );
    assert.ok(
      ['riviere', 'code'].includes(entree.bapteme),
      `« ${nom} » ne dit pas comment il est nommé à sa naissance (\`bapteme\` = ${JSON.stringify(entree.bapteme)}) — ` +
        `sans quoi il retombe sur un repli que personne n'a choisi pour lui, exactement comme un rôle de \`ROLES\``
    );
  }
});

test('🔴 LA TABLE ELLE-MÊME N’A AUCUNE ENTRÉE CACHÉE — les clés BRUTES, pas les énumérables', () => {
  // Un cran au-dessus du champ caché : une ENTRÉE posée non énumérable aurait toute
  // l'autorité de la table — `baptemeDuRole` lit par indexation, qui la voit — en restant
  // invisible à `rolesSansLieu()`, donc à l'épingle qui la garde.
  const brut = clesBrutesDesRolesSansLieu();
  assert.deepEqual(
    brut.table.map(String).sort(), ['chef-equipe'],
    `la table porte des clés que \`rolesSansLieu()\` ne rend pas (brut : ${brut.table.map(String).join(', ')}) — ` +
      `une entrée cachée décide autant qu'une entrée déclarée, et aucune épingle ne la voit`
  );
  for (const [nom, cles] of Object.entries(brut.entrees)) {
    assert.deepEqual(
      cles.map(String).sort(), ['bapteme', 'libelle'],
      `« ${nom} » porte des champs bruts que l'énumération ne rend pas : ${cles.map(String).join(', ')}`
    );
  }
});

test('🔴 `roleSansLieu` NE DÉCIDE NULLE PART EN PRODUCTION — le banc que le commentaire promettait', () => {
  // 🔴 CE BANC N'EXISTAIT PAS, ET LE COMMENTAIRE DE `roleSansLieu` AFFIRMAIT LE CONTRAIRE.
  // Mesuré par une passe de fond : elle a importé la fonction dans `bin/naitre.js`, lui a fait
  // décider une branche, et les 2 085 essais du dépôt sont restés VERTS. Une garantie écrite
  // au-delà de ce qui est mesuré arrête la personne qui allait vérifier — c'est le mode
  // d'erreur le plus cher de ce dépôt, et il venait d'être commis dans le geste qui en fermait
  // un autre.
  //
  // ⚠️ ON GARDE L'APPEL, PAS LE MOT. Chercher la chaîne « roleSansLieu » dans les sources
  // rendrait vrai un banc qu'un renommage désarme. On liste les fichiers de PRODUCTION et on
  // refuse l'IMPORT — la seule façon d'atteindre la fonction depuis un autre module.
  const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  // 🔴 LA POPULATION SE DÉRIVE DU DÉPÔT, ELLE NE S'ÉNUMÈRE PLUS — et c'est un défaut mesuré.
  // La liste en dur nommait quatre répertoires et en OUBLIAIT deux qui existent : `ligne-directe/bin`
  // et `cli/bin`, deux points d'entrée CLI réels. Un import posé dans `ligne-directe/bin/` décidait
  // pour de bon sans qu'aucun essai ne bouge. Une liste de chemins écrite à la main est périmée dès
  // qu'un répertoire naît, et personne ne s'en aperçoit — c'est la même famille que la population
  // d'un balayage qu'on demande au manifeste plutôt qu'à une liste (T-20260825-0013).
  //
  // ⚠️ `payload/` est ÉCARTÉ à dessein : c'est la copie distribuée du pack, pas la source.
  // 🔴 ET ON NE DÉRIVE PLUS `*/src` ET `*/bin` NON PLUS : MESURÉ, ÇA LAISSAIT UN TROU. Un import
  // réel posé dans `scripts/` — un répertoire de production sans `src/` ni `bin/` — restait vert.
  // Une convention de nommage est une liste en dur déguisée : elle décrit les répertoires qui
  // existaient le jour où on l'a écrite. On balaye donc TOUT le dépôt, et on ÉCARTE nommément
  // ce qui n'est pas de la production — la liste d'exclusions est courte, visible, et chacune
  // porte sa raison, là où la liste d'inclusions était longue et muette.
  const HORS_PRODUCTION = new Set(['node_modules', 'tests', 'test', 'payload', 'coverage', 'docs']);
  const RACINES = [RACINE];

  // ⚠️ CONTRÔLE DE L'INSTRUMENT : si la dérivation rend moins de répertoires que la liste en dur
  // qu'elle remplace, c'est elle qui est cassée — et le banc rendrait vert sans avoir rien lu.


  const fichiers = [];
  const balayer = (dir) => {
    let entrees;
    try { entrees = readdirSync(dir); } catch { return; }
    for (const e of entrees) {
      if (e.startsWith('.') || HORS_PRODUCTION.has(e)) continue;
      const chemin = join(dir, e);
      let st;
      try { st = statSync(chemin); } catch { continue; }
      if (st.isDirectory()) balayer(chemin);
      else if (e.endsWith('.js') || e.endsWith('.mjs')) fichiers.push(chemin);
    }
  };
  for (const d of RACINES) balayer(d);

  // ⚠️ CONTRÔLE DE L'INSTRUMENT : un balayage qui ne trouve rien rendrait ce banc vert pour
  // la mauvaise raison. On exige d'avoir vraiment lu du code de production.
  // ⚠️ CONTRÔLE DE L'INSTRUMENT : un balayage qui ne trouve rien rendrait ce banc vert pour la
  // mauvaise raison — il ne verrait aucun coupable parce qu'il n'aurait rien lu.
  //
  // 🔴 LE SEUIL EST ANCRÉ SUR UNE MESURE, PAS SUR UN CHIFFRE ROND. Première tentative : 150,
  // choisi au jugé — le banc a rougi en trouvant 126, et le rouge accusait le lot alors que
  // l'instrument seul était en cause. Mesuré le 2026-09-01 : l'ancienne dérivation
  // (`*/src` + `*/bin`) atteignait **102** fichiers ; le balayage complet en atteint **126**,
  // les 24 de plus venant de `gardes/` (9), `herdr-plugins/` (5) et de racines de paquets
  // (`scripts/`, `cli/`, `naissance-representant/`, `ligne-directe/`) — tous du code de
  // production réel, aucun n'était balayé.
  //
  // Le plancher est donc **102**, la borne de ce qu'on remplace : en descendre serait avoir
  // RÉTRÉCI la population en croyant l'élargir, et c'est ce qu'il faut voir. On ne fixe pas le
  // plancher à 126 : le compte de fichiers d'un dépôt vivant bouge, et une borne qui rougit à
  // chaque fichier supprimé cesse d'être lue.
  assert.ok(
    fichiers.length >= 102,
    `le balayage n'a trouvé que ${fichiers.length} fichier(s), moins que les 102 de la dérivation ` +
      `qu'il remplace — l'instrument a rétréci, ce n'est pas le lot qui est en cause`
  );

  const coupables = fichiers.filter((f) => {
    if (f.endsWith(`${'/'}roles.js`)) return false; // sa propre définition
    if (f.includes(`${'/'}payload${'/'}`)) return false; // copie distribuée, pas la source
    const src = readFileSync(f, 'utf8');
    // 🔴 TROIS FORMES, PARCE QU'UNE SEULE SE CONTOURNE — mesuré, pas supposé. La version
    // précédente ne cherchait que `import { roleSansLieu } from` : un
    // `import * as roles from '…/roles.js'` puis `roles.roleSansLieu(…)` passait dessous,
    // DANS un répertoire pourtant balayé, et décidait pour de bon.
    //
    //   ① l'import nommé — la forme directe ;
    //   ② l'import NAMESPACE de `roles.js` — il donne accès à TOUT ce que le module exporte,
    //     y compris ce qu'on ajoutera demain, donc on le refuse en bloc en production ;
    //   ③ le nom des accesseurs réservés, où qu'il apparaisse — attrape l'import dynamique
    //     (`await import(…)`) et la déstructuration différée.
    return /import\s*\{[^}]*\b(roleSansLieu|clesBrutesDesRolesSansLieu|tableSansLieuVerrouillee)\b[^}]*\}\s*from/.test(src)
        || /import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]*roles\.js['"]/.test(src)
        || /\b(roleSansLieu|clesBrutesDesRolesSansLieu|tableSansLieuVerrouillee)\b/.test(src);
  });
  assert.deepEqual(
    coupables.map((f) => f.slice(RACINE.length)), [],
    `ces fichiers de PRODUCTION importent un accesseur réservé aux bancs — ils contourneraient ` +
      `\`role()\`, la seule porte qui doit décider d'un rôle`
  );
});

test('🔴 LA TABLE SANS LIEU EST GELÉE ET SANS PROTOTYPE — on ne garde plus les chemins, on ferme l’objet', () => {
  // 🔴 CE BANC EXISTE PARCE QUE TROIS GARDES SUCCESSIVES ONT ÉTÉ CONTOURNÉES, chacune par un
  // mécanisme que la précédente ne regardait pas : un CHAMP non énumérable (`Object.keys` aveugle),
  // une ENTRÉE non énumérable (même lame plus haut), puis une entrée héritée du PROTOTYPE
  // (`Reflect.ownKeys` ne voit pas l'héritage, l'indexation si). À chaque fois la garde changeait
  // d'instrument sans changer de FORME — elle énumérait, et il restait une façon de ne pas être énuméré.
  //
  // ⚠️ CE BANC NE GARDE DONC PAS UN CHEMIN DE PLUS. Il garde que l'objet est HORS de la classe des
  // choses auxquelles on peut ajouter quoi que ce soit : gelé (aucun ajout, quel qu'en soit le
  // mécanisme) et sans prototype (aucune entrée ne peut entrer sans être une clé propre). Un `Proxy`
  // ou un getter, qu'on n'a pas eu à énumérer, tombent avec le reste.
  const v = tableSansLieuVerrouillee();
  assert.equal(v.gelee, true, 'la table n’est plus gelée — un module tiers peut y ajouter une entrée, et la garde qui énumère ne la verra pas forcément');
  assert.equal(v.sansPrototype, true, 'la table a retrouvé un prototype — une entrée héritée décide comme une entrée propre, sans être une clé propre');
  assert.equal(v.entreesGelees, true, 'une entrée n’est plus gelée — un champ (`dossier`, `pose_automatique`) peut y être ajouté depuis un autre module');
  assert.equal(v.inventeUneEntree, false, 'la table RÉPOND à une clé qu’elle ne contient pas — elle invente');

  // 🔴 ET LA MÊME QUESTION POSÉE PAR LA PORTE DE PRODUCTION, PAS PAR L'ATTESTATION DU MODULE.
  //
  // Les quatre lignes ci-dessus viennent de `roles.js` : c'est un oracle qui vit chez celui
  // qu'il juge. Un `Proxy` posé autour de la table le trompait ENTIÈREMENT — `isFrozen: true`,
  // prototype nul, mêmes `ownKeys` — pendant que `baptemeDuRole('fantome')` rendait `'code'`
  // au lieu de lever. Les trois attestations disaient vrai sur ce qu'elles regardaient.
  //
  // ⚠️ ON INTERROGE DONC LA CHAÎNE RÉELLE. `baptemeDuRole` est ce que la production appelle ;
  // s'il répond sur un rôle qui n'existe pas, la table invente — quel que soit le mécanisme,
  // et quoi que le module atteste de lui-même. Une seconde écriture de la même vérité, prise
  // à l'autre bout.
  // 🔴 DES NOMS TIRÉS AU HASARD, PAS UNE LISTE ÉCRITE DANS CE FICHIER — REJET d'une passe de
  // fond. Trois littéraux fixes (`'__aucun-role-ne-porte-ce-nom__'`, `'zorglub'`,
  // `'chef-equipe-bis'`) sont RESTÉS LISIBLES par quiconque triche : un `Proxy` dont le trap
  // répond honnêtement à ces trois-là précisément, et invente pour tout le reste, traversait
  // la suite ENTIÈRE (1226/1226) sans rougir. La garde testait des VALEURS que le code trichant
  // pouvait lire, pas une PROPRIÉTÉ qu'il ne peut pas anticiper.
  //
  // ⚠️ ET UNE LISTE PLUS LONGUE NE FERME RIEN — elle déplace juste la frontière d'un cran, et
  // le prochain contournement l'apprend par cœur comme celui-ci a appris les trois premiers
  // noms. La clé n'est donc plus ÉCRITE : elle est GÉNÉRÉE, à l'exécution, imprévisible au
  // moment où le module trichant se charge — rien dans le dépôt ne peut la connaître d'avance.
  const nomsAleatoires = Array.from(
    { length: 8 },
    () => `__genere-${Math.random().toString(36).slice(2)}-${Date.now()}__`
  );
  for (const invente of nomsAleatoires) {
    assert.throws(
      () => baptemeDuRole(invente),
      RoleInconnu,
      `\`baptemeDuRole('${invente}')\` a RÉPONDU sur un nom généré au hasard, qu'aucune source ` +
        `de ce dépôt n'a pu prévoir — la porte de production invente`
    );
  }

  // ⚠️ ET LES TROIS ANCIENS NOMS RESTENT ÉPROUVÉS — retirer un cas qu'on a fait rougir une fois
  // n'est pas un ménage, c'est un recul. Ils vivent maintenant à côté du hasard, pas à sa place.
  for (const invente of ['__aucun-role-ne-porte-ce-nom__', 'zorglub', 'chef-equipe-bis']) {
    assert.throws(
      () => baptemeDuRole(invente),
      RoleInconnu,
      `\`baptemeDuRole('${invente}')\` a RÉPONDU sur un rôle qui n'existe dans aucune des deux ` +
        `tables — la porte de production reçoit une entrée que personne n'a inscrite`
    );
  }
});
